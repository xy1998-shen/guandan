import type { Seat, Team } from './game.js';

/**
 * 房间状态
 */
export type RoomStatus = 'waiting' | 'playing' | 'finished';

/**
 * 房间座位信息
 */
export interface RoomSeat {
  /** 座位号 */
  seat: Seat;
  /** Agent ID */
  agentId: string;
  /** Agent 名称 */
  agentName: string;
  /** 所属队伍 */
  team: Team;
}

/**
 * 房间配置
 */
export interface RoomConfig {
  /** 出牌超时时间 (ms) */
  turnTimeout?: number;
  /** 每步之间的延迟 (ms) */
  stepDelay?: number;
}

/**
 * 房间信息
 */
export interface Room {
  /** 房间 ID */
  id: string;
  /** 房间名称 */
  name: string;
  /** 房间状态 */
  status: RoomStatus;
  /** 座位信息 */
  seats: RoomSeat[];
  /** 创建时间戳 */
  createdAt: number;
  /** 房间配置 */
  config?: RoomConfig;
  /** 当前局数（进行中房间） */
  currentRound?: number;
  /** A 队当前级数（进行中房间） */
  teamALevel?: string;
  /** B 队当前级数（进行中房间） */
  teamBLevel?: string;
}
