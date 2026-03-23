import type { GameStateView, AgentResponse } from '@guandan/shared';
import { TURN_TIMEOUT } from '@guandan/shared';

/**
 * Agent HTTP 回调客户端
 * 负责向 Agent 发送出牌请求并接收响应
 */
export class AgentClient {
  /**
   * 向 Agent 发送出牌请求
   * @param callbackUrl Agent 回调 URL
   * @param gameStateView 游戏状态视角
   * @param timeout 超时时间（毫秒），默认 TURN_TIMEOUT
   * @returns Agent 响应
   */
  async requestPlay(
    callbackUrl: string,
    gameStateView: GameStateView,
    timeout: number = TURN_TIMEOUT
  ): Promise<{ response: AgentResponse; timedOut: boolean; error: boolean }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gameStateView),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(
          `[AgentClient] Agent returned non-OK status: ${res.status} from ${callbackUrl}`
        );
        return {
          response: { action: 'pass' },
          timedOut: false,
          error: true,
        };
      }

      const data = await res.json() as AgentResponse;

      // 校验响应格式
      if (!data || typeof data !== 'object') {
        console.warn(`[AgentClient] Invalid response format from ${callbackUrl}`);
        return {
          response: { action: 'pass' },
          timedOut: false,
          error: true,
        };
      }

      // 校验 action 字段
      const action = (data as { action?: unknown }).action;
      if (action !== 'play' && action !== 'pass') {
        console.warn(
          `[AgentClient] Invalid action "${action}" from ${callbackUrl}`
        );
        return {
          response: { action: 'pass' },
          timedOut: false,
          error: true,
        };
      }

      // 如果是 play 动作，校验 cards 字段
      if (data.action === 'play') {
        if (!Array.isArray(data.cards) || data.cards.length === 0) {
          console.warn(`[AgentClient] Invalid cards in play action from ${callbackUrl}`);
          return {
            response: { action: 'pass' },
            timedOut: false,
            error: true,
          };
        }
      }

      return {
        response: data,
        timedOut: false,
        error: false,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // 处理超时
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`[AgentClient] Request timeout (${timeout}ms) for ${callbackUrl}`);
        return {
          response: { action: 'pass' },
          timedOut: true,
          error: false,
        };
      }

      // 处理网络错误
      console.error(`[AgentClient] Network error for ${callbackUrl}:`, error);
      return {
        response: { action: 'pass' },
        timedOut: false,
        error: true,
      };
    }
  }
}

// 导出单例
export const agentClient = new AgentClient();
