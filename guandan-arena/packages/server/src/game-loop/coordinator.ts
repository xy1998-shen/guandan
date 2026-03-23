import type {
  Seat,
  Team,
  Card,
  GameStateView,
  PlayerView,
  Rank,
  Combo,
  PlayerState,
  WsMessageType,
} from '@guandan/shared';
import {
  ComboType,
  STEP_DELAY,
  MAX_TIMEOUT_COUNT,
  MAX_VIOLATION_COUNT,
  TURN_TIMEOUT,
} from '@guandan/shared';
import { Game, detectCombo } from '@guandan/engine';
import { AgentClient, agentClient } from './agent-client.js';
import {
  saveRound,
  updateRound,
  savePlay,
  updateGameStatus,
  type LevelChange,
} from '../services/game.js';
import { deleteRoom, updateRoomStatus } from '../services/room.js';
import { spectatorManager } from '../ws/spectator-manager.js';
import { updateLeaderboardAfterGame, updateRoundStats } from '../services/rating.js';

/**
 * 玩家信息（含回调 URL）
 */
export interface PlayerInfo {
  seat: Seat;
  agentId: string;
  agentName: string;
  team: Team;
  callbackUrl: string;
}

/**
 * 简单的 sleep 函数
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 游戏协调器
 * 负责管理游戏生命周期和出牌循环
 */
export class GameCoordinator {
  private agentClient: AgentClient;
  private activeGames: Map<string, Game> = new Map(); // roomId -> Game
  private playerInfoMap: Map<string, Map<Seat, PlayerInfo>> = new Map(); // roomId -> (seat -> PlayerInfo)

  // 容错计数
  private timeoutCounts: Map<string, number> = new Map(); // agentId -> 连续超时次数
  private violationCounts: Map<string, number> = new Map(); // agentId -> 连续违规次数
  private disconnectedAgents: Set<string> = new Set(); // 已掉线的 agentId

  // 当前回合 ID（用于记录出牌）
  private currentRoundIds: Map<string, string> = new Map(); // roomId -> roundId

  constructor(client?: AgentClient) {
    this.agentClient = client || agentClient;
  }

  /**
   * 启动一场游戏
   * @param roomId 房间 ID
   * @param gameId 游戏 ID
   * @param players 玩家信息
   */
  async startGame(roomId: string, gameId: string, players: PlayerInfo[]): Promise<void> {
    console.log(`[Coordinator] Starting game ${gameId} in room ${roomId}`);

    // 初始化玩家信息 map
    const playerMap = new Map<Seat, PlayerInfo>();
    for (const p of players) {
      playerMap.set(p.seat, p);
    }
    this.playerInfoMap.set(roomId, playerMap);

    // 创建 Game 实例
    const playerInits = players.map((p) => ({
      seat: p.seat,
      agentId: p.agentId,
      agentName: p.agentName,
      team: p.team,
    }));
    const game = new Game(gameId, roomId, playerInits);
    this.activeGames.set(roomId, game);

    // 初始化容错计数
    for (const p of players) {
      this.timeoutCounts.set(p.agentId, 0);
      this.violationCounts.set(p.agentId, 0);
      this.disconnectedAgents.delete(p.agentId);
    }

    // Fire-and-forget: 启动游戏循环
    this.gameLoop(roomId, gameId).catch((error) => {
      console.error(`[Coordinator] Game loop error for room ${roomId}:`, error);
      this.cleanup(roomId);
    });
  }

  /**
   * 游戏主循环
   */
  private async gameLoop(roomId: string, gameId: string): Promise<void> {
    const game = this.activeGames.get(roomId);
    if (!game) {
      console.error(`[Coordinator] Game not found for room ${roomId}`);
      return;
    }

    try {
      // 外层循环：每一局
      while (game.getState().status !== 'finished') {
        // 1. 开始新一局
        const round = game.startNewRound();
        const trumpRank = round.state.trumpRank;
        const roundNumber = round.state.roundNumber;

        // 每局开始时重置连续超时计数
        const playerMapForReset = this.playerInfoMap.get(roomId);
        if (playerMapForReset) {
          for (const player of playerMapForReset.values()) {
            this.timeoutCounts.set(player.agentId, 0);
          }
        }

        console.log(`[Coordinator] Starting round ${roundNumber}, trump rank: ${trumpRank}`);

        // 广播 game_start / deal 事件
        this.broadcast(roomId, {
          event: 'round_start',
          data: {
            roundNumber,
            trumpRank,
            players: round.state.players.map((p: PlayerState) => ({
              seat: p.seat,
              agentName: p.agentName,
              team: p.team,
              handCount: p.handCount,
            })),
          },
        });

        // 预先创建 round 记录，以便出牌过程中能保存 play
        const preRoundId = await saveRound(
          gameId,
          roundNumber,
          trumpRank,
          [], // finishOrder 先留空，局结束后更新
          undefined
        );
        this.currentRoundIds.set(roomId, preRoundId);

        // 记录当前 trick 编号
        let trickNumber = 1;

        // 2. 出牌循环
        while (true) {
          const currentSeat = round.getCurrentSeat();

          // 如果为 null，本局结束
          if (currentSeat === null) {
            console.log(`[Coordinator] Round ${roundNumber} ended`);
            break;
          }

          const playerMap = this.playerInfoMap.get(roomId);
          if (!playerMap) break;

          const playerInfo = playerMap.get(currentSeat);
          if (!playerInfo) {
            console.error(`[Coordinator] Player info not found for seat ${currentSeat}`);
            break;
          }

          // 检查是否已掉线，直接自动 PASS
          if (this.disconnectedAgents.has(playerInfo.agentId)) {
            console.log(`[Coordinator] Agent ${playerInfo.agentName} is disconnected, auto PASS`);
            
            // 首出时不能 PASS，必须出最小的牌
            if (round.isLeading()) {
              // 找到手牌中的一张牌强制出
              const player = round.state.players.find((p: PlayerState) => p.seat === currentSeat);
              if (player && player.hand.length > 0) {
                const card = player.hand[0];
                const combo: Combo = {
                  type: ComboType.SINGLE,
                  cards: [card],
                  mainRank: card.rank,
                };
                const result = round.play(currentSeat, combo);
                if (result.valid) {
                  await savePlay(
                    this.currentRoundIds.get(roomId) || '',
                    trickNumber,
                    currentSeat,
                    ComboType.SINGLE,
                    [card]
                  );
                  this.broadcast(roomId, {
                    event: 'play',
                    data: { seat: currentSeat, combo, auto: true },
                  });
                }
              } else if (player && player.hand.length === 0) {
                // 异常兜底：空手牌但未标记完成，避免 currentSeat 卡死
                console.warn(
                  `[Coordinator] Empty hand anomaly at seat ${currentSeat}, force mark finished and skip`
                );

                if (!player.finished) {
                  player.finished = true;
                  player.finishOrder = round.state.finishOrder.length + 1;
                  round.state.finishOrder.push(currentSeat);
                }

                if (!round.isRoundOver() && round.state.currentTrick) {
                  let nextSeat = ((currentSeat + 1) % 4) as Seat;
                  for (let i = 0; i < 4; i++) {
                    const nextPlayer = round.state.players.find((p: PlayerState) => p.seat === nextSeat);
                    if (nextPlayer && !nextPlayer.finished) {
                      break;
                    }
                    nextSeat = ((nextSeat + 1) % 4) as Seat;
                  }
                  round.state.currentTrick.currentSeat = nextSeat;
                }
              }
            } else {
              round.pass(currentSeat);
              await savePlay(
                this.currentRoundIds.get(roomId) || '',
                trickNumber,
                currentSeat,
                ComboType.PASS,
                []
              );
              this.broadcast(roomId, {
                event: 'pass',
                data: { seat: currentSeat, auto: true },
              });
            }
            
            await sleep(STEP_DELAY);
            continue;
          }

          // 构建 GameStateView
          const view = this.buildGameStateView(game, currentSeat);

          // 广播当前回合出牌计时
          this.broadcast(roomId, {
            event: 'turn_start',
            data: {
              seat: currentSeat,
              agentName: playerInfo.agentName,
              startedAt: Date.now(),
              timeoutMs: TURN_TIMEOUT,
            },
          });

          // 请求 Agent 出牌
          const { response, timedOut } = await this.agentClient.requestPlay(
            playerInfo.callbackUrl,
            view
          );

          // 处理超时
          if (timedOut) {
            const count = (this.timeoutCounts.get(playerInfo.agentId) || 0) + 1;
            this.timeoutCounts.set(playerInfo.agentId, count);
            console.warn(
              `[Coordinator] Agent ${playerInfo.agentName} timeout (${count}/${MAX_TIMEOUT_COUNT})`
            );

            if (count >= MAX_TIMEOUT_COUNT) {
              console.warn(
                `[Coordinator] Agent ${playerInfo.agentName} disconnected due to consecutive timeouts`
              );
              this.disconnectedAgents.add(playerInfo.agentId);
            }
          }

          // 处理响应
          let playResult: { valid: boolean; reason?: string } = { valid: false };
          let playedCombo: Combo | null = null;

          if (response.action === 'pass') {
            // PASS
            if (round.isLeading()) {
              // 首出不能 PASS，记录违规
              const vCount = (this.violationCounts.get(playerInfo.agentId) || 0) + 1;
              this.violationCounts.set(playerInfo.agentId, vCount);
              console.warn(
                `[Coordinator] Agent ${playerInfo.agentName} violation: PASS on lead (${vCount}/${MAX_VIOLATION_COUNT})`
              );

              // 检查是否判负
              if (vCount >= MAX_VIOLATION_COUNT) {
                console.error(
                  `[Coordinator] Agent ${playerInfo.agentName} loses due to violations`
                );
                // 判负：对方队伍获胜
                const losingTeam = playerInfo.team;
                const winningTeam: Team = losingTeam === 'A' ? 'B' : 'A';
                await updateRoomStatus(roomId, 'finished');
                await updateGameStatus(gameId, 'finished', winningTeam);
                this.broadcast(roomId, {
                  event: 'game_end',
                  data: { winner: winningTeam, reason: 'violation' },
                });
                this.cleanup(roomId);
                return;
              }

              // 强制出最小的牌
              const player = round.state.players.find((p: PlayerState) => p.seat === currentSeat);
              if (player && player.hand.length > 0) {
                const card = player.hand[0];
                const combo: Combo = {
                  type: ComboType.SINGLE,
                  cards: [card],
                  mainRank: card.rank,
                };
                playResult = round.play(currentSeat, combo);
                if (playResult.valid) {
                  playedCombo = combo;
                }
              }
            } else {
              playResult = round.pass(currentSeat);
              if (playResult.valid) {
                playedCombo = { type: ComboType.PASS, cards: [] };
                // 只有非超时的成功出牌才重置计数
                if (!timedOut) {
                  this.timeoutCounts.set(playerInfo.agentId, 0);
                  this.violationCounts.set(playerInfo.agentId, 0);
                }
              }
            }
          } else if (response.action === 'play') {
            // 出牌
            const cards = response.cards as Card[];
            const detectedCombo = detectCombo(cards, trumpRank);

            if (!detectedCombo) {
              // 无法识别牌型，记录违规
              const vCount = (this.violationCounts.get(playerInfo.agentId) || 0) + 1;
              this.violationCounts.set(playerInfo.agentId, vCount);
              console.warn(
                `[Coordinator] Agent ${playerInfo.agentName} violation: invalid combo (${vCount}/${MAX_VIOLATION_COUNT})`
              );

              if (vCount >= MAX_VIOLATION_COUNT) {
                const losingTeam = playerInfo.team;
                const winningTeam: Team = losingTeam === 'A' ? 'B' : 'A';
                await updateRoomStatus(roomId, 'finished');
                await updateGameStatus(gameId, 'finished', winningTeam);
                this.broadcast(roomId, {
                  event: 'game_end',
                  data: { winner: winningTeam, reason: 'violation' },
                });
                this.cleanup(roomId);
                return;
              }

              // 强制 PASS（如果可以的话）
              if (!round.isLeading()) {
                playResult = round.pass(currentSeat);
                if (playResult.valid) {
                  playedCombo = { type: ComboType.PASS, cards: [] };
                }
              } else {
                // 首出强制出单张
                const player = round.state.players.find((p: PlayerState) => p.seat === currentSeat);
                if (player && player.hand.length > 0) {
                  const card = player.hand[0];
                  const combo: Combo = {
                    type: ComboType.SINGLE,
                    cards: [card],
                    mainRank: card.rank,
                  };
                  playResult = round.play(currentSeat, combo);
                  if (playResult.valid) {
                    playedCombo = combo;
                  }
                }
              }
            } else {
              // 尝试出牌
              playResult = round.play(currentSeat, detectedCombo);

              if (playResult.valid) {
                playedCombo = detectedCombo;
                // 成功出牌，重置计数
                this.timeoutCounts.set(playerInfo.agentId, 0);
                this.violationCounts.set(playerInfo.agentId, 0);
              } else {
                // 出牌非法，记录违规
                const vCount = (this.violationCounts.get(playerInfo.agentId) || 0) + 1;
                this.violationCounts.set(playerInfo.agentId, vCount);
                console.warn(
                  `[Coordinator] Agent ${playerInfo.agentName} violation: ${playResult.reason} (${vCount}/${MAX_VIOLATION_COUNT})`
                );

                if (vCount >= MAX_VIOLATION_COUNT) {
                  const losingTeam = playerInfo.team;
                  const winningTeam: Team = losingTeam === 'A' ? 'B' : 'A';
                  await updateRoomStatus(roomId, 'finished');
                  await updateGameStatus(gameId, 'finished', winningTeam);
                  this.broadcast(roomId, {
                    event: 'game_end',
                    data: { winner: winningTeam, reason: 'violation' },
                  });
                  this.cleanup(roomId);
                  return;
                }

                // 强制 PASS
                if (!round.isLeading()) {
                  playResult = round.pass(currentSeat);
                  if (playResult.valid) {
                    playedCombo = { type: ComboType.PASS, cards: [] };
                  }
                } else {
                  const player = round.state.players.find((p: PlayerState) => p.seat === currentSeat);
                  if (player && player.hand.length > 0) {
                    const card = player.hand[0];
                    const combo: Combo = {
                      type: ComboType.SINGLE,
                      cards: [card],
                      mainRank: card.rank,
                    };
                    playResult = round.play(currentSeat, combo);
                    if (playResult.valid) {
                      playedCombo = combo;
                    }
                  }
                }
              }
            }
          }

          // 记录出牌到数据库
          if (playedCombo && this.currentRoundIds.get(roomId)) {
            await savePlay(
              this.currentRoundIds.get(roomId)!,
              trickNumber,
              currentSeat,
              playedCombo.type,
              playedCombo.cards
            );
          }

          // 广播出牌事件
          if (playedCombo) {
            if (playedCombo.type === ComboType.PASS) {
              this.broadcast(roomId, {
                event: 'pass',
                data: { seat: currentSeat },
              });
            } else {
              this.broadcast(roomId, {
                event: 'play',
                data: { seat: currentSeat, combo: playedCombo },
              });
            }
          }

          // 检查玩家是否出完
          const player = round.state.players.find((p: PlayerState) => p.seat === currentSeat);
          if (player && player.finished && player.finishOrder !== null) {
            this.broadcast(roomId, {
              event: 'player_finish',
              data: {
                seat: currentSeat,
                finishOrder: player.finishOrder,
              },
            });
          }

          // 更新 trickNumber（如果开始了新的 trick）
          if (round.state.currentTrick && round.state.currentTrick.plays.length === 0) {
            trickNumber++;
          }

          // 延迟
          await sleep(STEP_DELAY);
        }

        // 3. 一局结束
        const finishOrder = round.getFinishOrder();

        // 在 endRound 之前读取旧级数（endRound 会修改级数）
        const gameStateBefore = game.getState();
        const oldTeamALevel = gameStateBefore.teamALevel;
        const oldTeamBLevel = gameStateBefore.teamBLevel;

        const endResult = game.endRound(finishOrder);

        // 构建 levelChange
        let levelChange: LevelChange | undefined;
        if (endResult.result.levelUp > 0) {
          const winTeam = endResult.result.winningTeam;
          const oldLevel = winTeam === 'A' ? oldTeamALevel : oldTeamBLevel;
          const newLevel = winTeam === 'A'
            ? game.getState().teamALevel
            : game.getState().teamBLevel;
          levelChange = {
            team: winTeam,
            from: oldLevel,
            to: newLevel as Rank,
            levelUp: endResult.result.levelUp,
          };
        }

        // 更新 round 记录（补充 finishOrder 和 levelChange）
        const roundId = this.currentRoundIds.get(roomId) || preRoundId;
        await updateRound(roundId, finishOrder, levelChange);

        // 更新回合统计
        try {
          const playerMapForStats = this.playerInfoMap.get(roomId);
          if (playerMapForStats) {
            const participantAgentIds: string[] = [];
            const winnerAgentIds: string[] = [];
            const roundWinningTeam = endResult.result.winningTeam;

            for (const player of playerMapForStats.values()) {
              participantAgentIds.push(player.agentId);
              if (player.team === roundWinningTeam) {
                winnerAgentIds.push(player.agentId);
              }
            }

            await updateRoundStats({
              participantAgentIds,
              winnerAgentIds,
            });
            console.log(`[Coordinator] Round ${roundNumber} stats updated for agents: ${participantAgentIds.join(', ')}`);
          }
        } catch (error) {
          console.error(`[Coordinator] Failed to update round stats:`, error);
          // 积分更新失败不影响游戏主流程
        }

        // 广播 round_end
        this.broadcast(roomId, {
          event: 'round_end',
          data: {
            roundNumber,
            finishOrder,
            result: endResult.result,
            teamLevels: {
              A: game.getState().teamALevel,
              B: game.getState().teamBLevel,
            },
          },
        });

        // 检查游戏是否结束
        if (endResult.gameOver) {
          console.log(`[Coordinator] Game ended! Winner: Team ${endResult.winner}`);
          
          // 更新排行榜（ELO + 胜负统计）
          try {
            const playerMapForLeaderboard = this.playerInfoMap.get(roomId);
            if (playerMapForLeaderboard) {
              const teamAAgentIds: string[] = [];
              const teamBAgentIds: string[] = [];

              for (const player of playerMapForLeaderboard.values()) {
                if (player.team === 'A') {
                  teamAAgentIds.push(player.agentId);
                } else {
                  teamBAgentIds.push(player.agentId);
                }
              }

              await updateLeaderboardAfterGame({
                winningTeam: endResult.winner!,
                teamAAgentIds,
                teamBAgentIds,
              });
              console.log(`[Coordinator] Leaderboard updated - Winner: Team ${endResult.winner}, Team A: [${teamAAgentIds.join(', ')}], Team B: [${teamBAgentIds.join(', ')}]`);
            }
          } catch (error) {
            console.error(`[Coordinator] Failed to update leaderboard:`, error);
            // 积分更新失败不影响游戏主流程
          }
          
          // 立即更新房间状态为 finished，让 Agent 可以加入新房间
          await updateRoomStatus(roomId, 'finished');
          
          await updateGameStatus(
            gameId,
            'finished',
            endResult.winner,
            game.getState().teamALevel,
            game.getState().teamBLevel
          );
          this.broadcast(roomId, {
            event: 'game_end',
            data: { winner: endResult.winner },
          });
          
          // 延迟 10 秒后清理房间（给观战者看结果的时间）
          console.log(`[Coordinator] Room ${roomId} will be cleaned up in 10 seconds...`);
          setTimeout(async () => {
            try {
              await deleteRoom(roomId);
              console.log(`[Coordinator] Game finished, room ${roomId} has been deleted`);
            } catch (error) {
              console.error(`[Coordinator] Failed to delete room ${roomId}:`, error);
            }
          }, 10000);
          
          this.cleanup(roomId);
          return;
        }

        // 更新数据库中的级数
        await updateGameStatus(
          gameId,
          'playing',
          undefined,
          game.getState().teamALevel,
          game.getState().teamBLevel
        );
      }
    } catch (error) {
      console.error(`[Coordinator] Unexpected error in game loop:`, error);
      this.cleanup(roomId);
    }
  }

  /**
   * 构建 GameStateView
   */
  private buildGameStateView(game: Game, seat: Seat): GameStateView {
    const state = game.getState();
    const round = game.currentRound;

    if (!round) {
      throw new Error('No active round');
    }

    const player = round.state.players.find((p: PlayerState) => p.seat === seat);
    if (!player) {
      throw new Error(`Player not found for seat ${seat}`);
    }

    // 其他玩家信息
    const players: PlayerView[] = round.state.players.map((p: PlayerState) => ({
      seat: p.seat,
      agentName: p.agentName,
      team: p.team,
      handCount: p.handCount,
      finished: p.finished,
    }));

    return {
      action: 'play',
      mySeat: seat,
      myTeam: player.team,
      myHand: player.hand,
      trumpRank: round.state.trumpRank,
      currentTrick: round.state.currentTrick,
      isMyTurnToLead: round.isLeading(),
      players,
      teamLevels: {
        A: state.teamALevel,
        B: state.teamBLevel,
      },
      history: round.state.trickHistory,
    };
  }

  /**
   * 广播消息给旁观者
   * @param roomId 房间 ID
   * @param message 消息对象，包含 event 和 data
   */
  private broadcast(roomId: string, message: { event: string; data: unknown }): void {
    // 映射 event 到 WsMessageType
    const eventToType: Record<string, WsMessageType> = {
      'round_start': 'game_start',
      'turn_start': 'turn_start',
      'deal': 'deal',
      'play': 'play',
      'pass': 'pass',
      'trick_end': 'trick_end',
      'player_finish': 'player_finish',
      'round_end': 'round_end',
      'game_end': 'game_end',
      'error': 'error',
    };

    const type = eventToType[message.event];
    
    if (type) {
      // 使用 spectatorManager 进行真正的 WebSocket 广播
      spectatorManager.broadcast(roomId, type, message.data);
    }
    
    // 同时保留 console.log 用于调试
    console.log(`[Broadcast][Room ${roomId}]`, JSON.stringify(message));
  }

  /**
   * 停止游戏
   */
  stopGame(roomId: string): void {
    console.log(`[Coordinator] Stopping game in room ${roomId}`);
    this.cleanup(roomId);
  }

  /**
   * 清理游戏资源
   */
  private cleanup(roomId: string): void {
    this.activeGames.delete(roomId);

    const playerMap = this.playerInfoMap.get(roomId);
    if (playerMap) {
      for (const player of playerMap.values()) {
        this.timeoutCounts.delete(player.agentId);
        this.violationCounts.delete(player.agentId);
        this.disconnectedAgents.delete(player.agentId);
      }
    }

    this.playerInfoMap.delete(roomId);
    this.currentRoundIds.delete(roomId);
    
    // 清理旁观者连接
    spectatorManager.cleanRoom(roomId);
  }

  /**
   * 获取活跃游戏
   */
  getActiveGame(roomId: string): Game | undefined {
    return this.activeGames.get(roomId);
  }
}

// 导出单例
export const coordinator = new GameCoordinator();
