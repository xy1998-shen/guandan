/**
 * WebSocket 消息类型
 */
export type WsMessageType =
  | 'game_start'
  | 'turn_start'
  | 'deal'
  | 'play'
  | 'pass'
  | 'trick_end'
  | 'player_finish'
  | 'round_end'
  | 'game_end'
  | 'error';

/**
 * WebSocket 消息
 */
export interface WsMessage {
  /** 消息类型 */
  type: WsMessageType;
  /** 消息数据 */
  data: unknown;
  /** 时间戳 */
  timestamp: number;
}
