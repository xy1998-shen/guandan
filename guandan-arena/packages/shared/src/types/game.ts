import type { Card, Rank } from './card.js';
import type { Combo } from './combo.js';

/**
 * 队伍: A队 或 B队
 */
export type Team = 'A' | 'B';

/**
 * 座位号: 0-3
 * 座位0和2是A队，座位1和3是B队
 */
export type Seat = 0 | 1 | 2 | 3;

/**
 * 游戏状态
 */
export type GameStatus = 'waiting' | 'playing' | 'finished';

/**
 * 回合状态
 */
export type RoundStatus = 'dealing' | 'playing' | 'finished';

/**
 * 玩家状态
 */
export interface PlayerState {
  /** 座位号 */
  seat: Seat;
  /** Agent ID */
  agentId: string;
  /** Agent 名称 */
  agentName: string;
  /** 所属队伍 */
  team: Team;
  /** 手牌 */
  hand: Card[];
  /** 手牌数量 */
  handCount: number;
  /** 是否已完成出牌 */
  finished: boolean;
  /** 完成顺序 (null 表示未完成) */
  finishOrder: number | null;
}

/**
 * 单次出牌记录
 */
export interface TrickPlay {
  /** 出牌玩家座位号 */
  seat: Seat;
  /** 出的牌型 */
  combo: Combo;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 一轮出牌 (从领牌到所有人不要/接不住)
 */
export interface Trick {
  /** 出牌记录 */
  plays: TrickPlay[];
  /** 领牌玩家座位号 */
  leadSeat: Seat;
  /** 当前应该出牌的座位号 */
  currentSeat: Seat;
  /** 连续不要的次数 */
  passCount: number;
}

/**
 * 单局回合状态
 */
export interface RoundState {
  /** 回合编号 */
  roundNumber: number;
  /** 当前级牌 */
  trumpRank: Rank;
  /** 回合状态 */
  status: RoundStatus;
  /** 玩家状态 */
  players: PlayerState[];
  /** 当前一轮出牌 */
  currentTrick: Trick | null;
  /** 完成顺序的座位列表 */
  finishOrder: Seat[];
  /** 历史出牌记录 */
  trickHistory: Trick[];
}

/**
 * 完整游戏状态
 */
export interface GameState {
  /** 游戏 ID */
  gameId: string;
  /** 房间 ID */
  roomId: string;
  /** 游戏状态 */
  status: GameStatus;
  /** A队当前级数 */
  teamALevel: Rank;
  /** B队当前级数 */
  teamBLevel: Rank;
  /** 当前回合状态 */
  currentRound: RoundState | null;
  /** 历史回合记录 */
  roundHistory: RoundState[];
  /** 获胜队伍 */
  winner: Team | null;
}

/**
 * 推送给 Agent 的玩家视角信息
 */
export interface PlayerView {
  /** 座位号 */
  seat: Seat;
  /** Agent 名称 */
  agentName: string;
  /** 所属队伍 */
  team: Team;
  /** 手牌数量 */
  handCount: number;
  /** 是否已完成出牌 */
  finished: boolean;
}

/**
 * 推送给 Agent 的游戏状态视角
 */
export interface GameStateView {
  /** 动作类型 */
  action: 'play';
  /** 自己的座位号 */
  mySeat: Seat;
  /** 自己的队伍 */
  myTeam: Team;
  /** 自己的手牌 */
  myHand: Card[];
  /** 当前级牌 */
  trumpRank: Rank;
  /** 当前一轮出牌 */
  currentTrick: Trick | null;
  /** 是否轮到自己领牌 */
  isMyTurnToLead: boolean;
  /** 其他玩家信息 */
  players: PlayerView[];
  /** 两队级数 */
  teamLevels: { A: Rank; B: Rank };
  /** 历史出牌记录 */
  history: Trick[];
}
