import type { Card } from './card.js';
import type { GameStateView } from './game.js';

/**
 * Agent 信息
 */
export interface Agent {
  /** Agent ID */
  id: string;
  /** Agent 名称 */
  name: string;
  /** 回调 URL */
  callbackUrl: string;
  /** API Token */
  apiToken: string;
  /** 创建时间戳 */
  createdAt: number;
  /** 是否活跃 */
  active: boolean;
  /** 所属用户标识（用于前端视角绑定） */
  ownerId?: string;
}

/**
 * Agent 回调请求 (服务器 -> Agent)
 */
export interface AgentCallbackRequest extends GameStateView {}

/**
 * Agent 出牌响应
 */
export interface AgentPlayResponse {
  /** 动作类型: 出牌 */
  action: 'play';
  /** 要打出的牌 */
  cards: Card[];
}

/**
 * Agent 过牌响应
 */
export interface AgentPassResponse {
  /** 动作类型: 过牌 */
  action: 'pass';
}

/**
 * Agent 响应类型
 */
export type AgentResponse = AgentPlayResponse | AgentPassResponse;
