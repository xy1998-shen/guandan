import { useState, useEffect, useCallback, useRef } from 'react';
import { ComboType, type WsMessage, type GameState, type RoundState, type Combo, type Seat, type Team } from '../types';
import { getComboDisplayName } from '../utils/comboName';

interface UseGameSocketOptions {
  roomId: string;
  onMessage?: (message: WsMessage) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  onClose?: () => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

interface GameSocketState {
  connected: boolean;
  spectatorCount: number;
  gameState: GameState | null;
  logs: LogEntry[];
  roundSummary: RoundSummary | null;
  gameSummary: GameSummary | null;
  turnInfo: TurnInfo | null;
}

interface LogEntry {
  id: number;
  time: string;
  message: string;
  actor?: string;
  action?: string;
  comboType?: string;
  cards?: string;
  type: 'info' | 'play' | 'pass' | 'bomb' | 'finish' | 'round' | 'game';
}

interface RoundSummary {
  winnerTeam: Team;
  levelUp: number;
  oldLevel: string;
  newLevel: string;
  topSeat: Seat | null;
  lastSeat: Seat | null;
  message: string;
}

interface GameSummary {
  winner: Team;
  teamALevel: string;
  teamBLevel: string;
}

interface TurnInfo {
  seat: Seat;
  agentName: string;
  timeoutMs: number;
  startedAt: number;
  remainingMs: number;
}

let logIdCounter = 0;

function createLog(message: string, type: LogEntry['type'] = 'info'): LogEntry {
  return {
    id: ++logIdCounter,
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    message,
    type,
  };
}

function formatCombo(combo: Combo): string {
  if (combo.type === ComboType.PASS) return '过';
  const cards = combo.cards.map(c => {
    if (c.rank === 'SMALL') return '小王';
    if (c.rank === 'BIG') return '大王';
    const suitMap: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
    return `${suitMap[c.suit] || ''}${c.rank}`;
  }).join(' ');
  return cards;
}

function formatCardsText(combo: Combo): string {
  if (combo.type === ComboType.PASS) return '';
  return formatCombo(combo);
}

export function useGameSocket(options: UseGameSocketOptions) {
  const {
    roomId,
    onMessage,
    onError,
    onOpen,
    onClose,
    autoReconnect = true,
    reconnectInterval = 3000,
  } = options;

  const [state, setState] = useState<GameSocketState>({
    connected: false,
    spectatorCount: 0,
    gameState: null,
    logs: [],
    roundSummary: null,
    gameSummary: null,
    turnInfo: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const mountedRef = useRef(true);
  const shouldConnectRef = useRef(true);  // 防止 StrictMode 双重执行导致的断连
  const connectingRef = useRef(false);    // 防止重复连接

  const addLog = useCallback((
    message: string,
    type: LogEntry['type'] = 'info',
    extra?: { actor?: string; action?: string; comboType?: string; cards?: string }
  ) => {
    if (!mountedRef.current) return;
    setState(prev => ({
      ...prev,
      logs: [...prev.logs.slice(-49), { ...createLog(message, type), ...extra }],
    }));
  }, []);

  const connect = useCallback(() => {
    // 防止重复连接
    if (connectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) return;
    if (!shouldConnectRef.current) return;
    
    connectingRef.current = true;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/spectate/${roomId}`;

    console.log('[WebSocket] Connecting to:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WebSocket] Connected');
      connectingRef.current = false;
      reconnectAttemptRef.current = 0;
      if (!mountedRef.current || !shouldConnectRef.current) {
        // StrictMode 清理后的回调，忽略
        ws.close();
        return;
      }
      setState(prev => ({ ...prev, connected: true }));
      addLog('已连接到观战频道', 'info');
      onOpen?.();
    };

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
      connectingRef.current = false;
      
      // 如果不应该连接（组件已卸载或 StrictMode 清理），不做任何处理
      if (!shouldConnectRef.current) return;
      if (!mountedRef.current) return;
      
      setState(prev => ({ ...prev, connected: false }));
      addLog('连接已断开', 'info');
      onClose?.();

      // Auto reconnect - 只有在应该保持连接时才重连
      if (autoReconnect && mountedRef.current && shouldConnectRef.current) {
        const attempt = reconnectAttemptRef.current;
        const delay = Math.min(reconnectInterval * Math.pow(2, attempt), 30000);
        reconnectAttemptRef.current = attempt + 1;

        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (mountedRef.current && shouldConnectRef.current) {
            addLog(`正在重连（第 ${attempt + 1} 次，${Math.round(delay / 1000)}s 后）...`, 'info');
            connect();
          }
        }, delay);
      }
    };

    ws.onerror = (event) => {
      console.error('[WebSocket] Error:', event);
      onError?.(event);
    };

    ws.onmessage = (event) => {
      try {
        const message: WsMessage = JSON.parse(event.data);
        console.log('[WebSocket] Message:', message.type, message.data);
        onMessage?.(message);

        if (!mountedRef.current) return;

        // Update state based on message type
        switch (message.type) {
          case 'turn_start': {
            const data = message.data as { seat: Seat; agentName: string; startedAt: number; timeoutMs: number };
            setState(prev => ({
              ...prev,
              turnInfo: {
                seat: data.seat,
                agentName: data.agentName,
                timeoutMs: data.timeoutMs,
                startedAt: data.startedAt,
                remainingMs: data.timeoutMs,
              },
            }));
            break;
          }

          case 'game_start': {
            const data = message.data as { spectatorCount?: number; roomId?: string; gameState?: GameState };
            setState(prev => ({
              ...prev,
              spectatorCount: data.spectatorCount || prev.spectatorCount,
              gameState: data.gameState || prev.gameState,
            }));
            if (data.gameState) {
              addLog('游戏开始！', 'game');
            }
            break;
          }

          case 'deal': {
            const data = message.data as { roundState: RoundState };
            setState(prev => ({
              ...prev,
              gameState: prev.gameState ? {
                ...prev.gameState,
                status: 'playing',
                currentRound: data.roundState,
              } : null,
            }));
            addLog(`第 ${data.roundState.roundNumber} 回合开始，级牌: ${data.roundState.trumpRank}`, 'round');
            break;
          }

          case 'play': {
            const data = message.data as { seat: Seat; combo: Combo; roundState: RoundState };
            setState(prev => ({
              ...prev,
              gameState: prev.gameState ? {
                ...prev.gameState,
                currentRound: data.roundState,
              } : null,
            }));
            const player = data.roundState.players.find(p => p.seat === data.seat);
            const playerName = player?.agentName || `玩家${data.seat}`;
            const comboStr = formatCombo(data.combo);
            const comboName = getComboDisplayName(data.combo);
            const cards = formatCardsText(data.combo);
            const isBomb = data.combo.type.toString().includes('BOMB') || 
                          data.combo.type === 'STRAIGHT_FLUSH' || 
                          data.combo.type === 'ROCKET';
            addLog(`${playerName} 出牌: ${comboName} ${comboStr}`.trim(), isBomb ? 'bomb' : 'play', {
              actor: playerName,
              action: `出牌: ${comboName} ${comboStr}`.trim(),
              comboType: String(data.combo.type),
              cards,
            });
            setState(prev => ({ ...prev, turnInfo: null }));
            break;
          }

          case 'pass': {
            const data = message.data as { seat: Seat; roundState: RoundState };
            setState(prev => ({
              ...prev,
              gameState: prev.gameState ? {
                ...prev.gameState,
                currentRound: data.roundState,
              } : null,
            }));
            const player = data.roundState.players.find(p => p.seat === data.seat);
            const playerName = player?.agentName || `玩家${data.seat}`;
            addLog(`${playerName} 过`, 'pass', {
              actor: playerName,
              action: '过',
            });
            setState(prev => ({ ...prev, turnInfo: null }));
            break;
          }

          case 'trick_end': {
            const data = message.data as { winnerSeat: Seat; roundState: RoundState };
            setState(prev => ({
              ...prev,
              gameState: prev.gameState ? {
                ...prev.gameState,
                currentRound: data.roundState,
              } : null,
            }));
            const player = data.roundState.players.find(p => p.seat === data.winnerSeat);
            const playerName = player?.agentName || `玩家${data.winnerSeat}`;
            addLog(`${playerName} 收牌`, 'info');
            break;
          }

          case 'player_finish': {
            const data = message.data as { seat: Seat; finishOrder: number; roundState: RoundState };
            setState(prev => ({
              ...prev,
              gameState: prev.gameState ? {
                ...prev.gameState,
                currentRound: data.roundState,
              } : null,
            }));
            const player = data.roundState.players.find(p => p.seat === data.seat);
            const playerName = player?.agentName || `玩家${data.seat}`;
            const orderText = ['头游', '二游', '三游', '末游'][data.finishOrder - 1] || `第${data.finishOrder}`;
            addLog(`${playerName} ${orderText}！`, 'finish');
            break;
          }

          case 'round_end': {
            const data = message.data as {
              result?: { winningTeam: Team; levelUp: number };
              finishOrder?: Seat[];
              teamLevels?: { A: string; B: string };
              gameState?: GameState;
            };
            setState(prev => ({
              ...prev,
              gameState: data.gameState || prev.gameState,
              roundSummary: (() => {
                if (!data.result || !data.teamLevels) return prev.roundSummary;
                const winnerTeam = data.result.winningTeam;
                const newLevel = winnerTeam === 'A' ? data.teamLevels.A : data.teamLevels.B;
                const oldLevel = prev.gameState
                  ? (winnerTeam === 'A' ? prev.gameState.teamALevel : prev.gameState.teamBLevel)
                  : newLevel;
                const topSeat = data.finishOrder && data.finishOrder.length > 0 ? data.finishOrder[0] : null;
                const lastSeat = data.finishOrder && data.finishOrder.length > 0
                  ? data.finishOrder[data.finishOrder.length - 1]
                  : null;
                const levelMessage = data.result.levelUp > 0
                  ? `Team ${winnerTeam} 升 ${data.result.levelUp} 级: ${oldLevel} -> ${newLevel}`
                  : `Team ${winnerTeam} 保持级数: ${newLevel}`;
                return {
                  winnerTeam,
                  levelUp: data.result.levelUp,
                  oldLevel,
                  newLevel,
                  topSeat,
                  lastSeat,
                  message: levelMessage,
                };
              })(),
            }));
            const gameStateForLog = data.gameState;
            if (gameStateForLog) {
              addLog(`回合结束，A队级数: ${gameStateForLog.teamALevel}，B队级数: ${gameStateForLog.teamBLevel}`, 'round');
            } else if (data.teamLevels) {
              addLog(`回合结束，A队级数: ${data.teamLevels.A}，B队级数: ${data.teamLevels.B}`, 'round');
            }
            break;
          }

          case 'game_end': {
            const data = message.data as { winner: Team; gameState?: GameState };
            setState(prev => ({
              ...prev,
              gameState: data.gameState || prev.gameState,
              gameSummary: {
                winner: data.winner,
                teamALevel: (data.gameState || prev.gameState)?.teamALevel || '-',
                teamBLevel: (data.gameState || prev.gameState)?.teamBLevel || '-',
              },
              turnInfo: null,
            }));
            addLog(`游戏结束！${data.winner}队获胜！`, 'game');
            break;
          }

          case 'error': {
            const data = message.data as { message: string };
            addLog(`错误: ${data.message}`, 'info');
            break;
          }
        }
      } catch (err) {
        console.error('[WebSocket] Parse error:', err);
      }
    };
  }, [roomId, onMessage, onError, onOpen, onClose, autoReconnect, reconnectInterval, addLog]);

  const disconnect = useCallback(() => {
    shouldConnectRef.current = false;  // 标记不应该再连接
    connectingRef.current = false;
    reconnectAttemptRef.current = 0;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    shouldConnectRef.current = true;  // 重新启用连接
    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [roomId]);  // 只依赖 roomId，避免不必要的重连

  useEffect(() => {
    if (!state.turnInfo) return;
    const timer = window.setInterval(() => {
      setState(prev => {
        if (!prev.turnInfo) return prev;
        const elapsed = Date.now() - prev.turnInfo.startedAt;
        const remainingMs = Math.max(0, prev.turnInfo.timeoutMs - elapsed);
        if (remainingMs <= 0) {
          return { ...prev, turnInfo: null };
        }
        return {
          ...prev,
          turnInfo: {
            ...prev.turnInfo,
            remainingMs,
          },
        };
      });
    }, 200);
    return () => window.clearInterval(timer);
  }, [state.turnInfo?.startedAt]);

  return {
    ...state,
    connect,
    disconnect,
  };
}
