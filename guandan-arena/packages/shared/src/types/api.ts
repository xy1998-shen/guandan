import type { Seat, Team } from './game.js';
import type { RoomConfig } from './room.js';

// ============ Agent 注册 ============

/**
 * 注册 Agent 请求
 */
export interface RegisterAgentRequest {
  /** Agent 名称 */
  name: string;
  /** 回调 URL */
  callbackUrl: string;
  /** 所属用户标识（可选） */
  ownerId?: string;
}

/**
 * 注册 Agent 响应
 */
export interface RegisterAgentResponse {
  /** Agent ID */
  agentId: string;
  /** API Token */
  apiToken: string;
}

// ============ 房间相关 ============

/**
 * 创建房间请求
 */
export interface CreateRoomRequest {
  /** 房间名称 */
  name: string;
  /** 房间配置 */
  config?: RoomConfig;
}

/**
 * 加入房间请求
 */
export interface JoinRoomRequest {
  /** Agent ID */
  agentId: string;
  /** 指定座位号 (可选) */
  seat?: Seat;
  /** 指定队伍 (可选) */
  team?: Team;
}

/**
 * 开始游戏请求
 */
export interface StartRoomRequest {
  /** 发起开始的 Agent ID */
  agentId: string;
}

// ============ 通用响应 ============

/**
 * 通用 API 响应
 */
export interface ApiResponse<T> {
  /** 是否成功 */
  success: boolean;
  /** 响应数据 */
  data?: T;
  /** 错误信息 */
  error?: string;
}
