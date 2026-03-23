import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { WsMessage, WsMessageType } from '@guandan/shared';

/**
 * 旁观者管理器
 * 管理 WebSocket 连接和消息广播
 */
class SpectatorManager {
  private wss: WebSocketServer | null = null;
  private rooms: Map<string, Set<WebSocket>> = new Map();
  
  // 心跳检测间隔 (30秒)
  private readonly HEARTBEAT_INTERVAL = 30000;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  /**
   * 初始化 WebSocket 服务（附加到 HTTP Server）
   * @param server HTTP Server 实例
   */
  init(server: http.Server): void {
    // 创建 WebSocketServer，使用 noServer 模式以手动控制 upgrade 处理
    // 避免 ws 库自动监听 upgrade 事件导致重复处理
    this.wss = new WebSocketServer({ noServer: true });

    // 处理 upgrade 请求，根据路径解析 roomId
    server.on('upgrade', (request, socket, head) => {
      const url = request.url || '';
      
      // 解析路径: /ws/spectate/:roomId
      const match = url.match(/^\/ws\/spectate\/([^/?]+)/);
      
      if (match && this.wss) {
        const roomId = match[1];
        
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          // 将 roomId 附加到 ws 对象上
          (ws as any).roomId = roomId;
          this.wss!.emit('connection', ws, request);
        });
      } else {
        // 非旁观路径，关闭连接
        socket.destroy();
      }
    });

    // 监听连接事件
    this.wss.on('connection', (ws: WebSocket) => {
      const roomId = (ws as any).roomId as string;
      
      if (!roomId) {
        ws.close(1008, 'Invalid room ID');
        return;
      }

      console.log(`[SpectatorManager] New spectator connected to room ${roomId}`);

      // 将连接加入对应房间的观众集合
      if (!this.rooms.has(roomId)) {
        this.rooms.set(roomId, new Set());
      }
      this.rooms.get(roomId)!.add(ws);

      // 标记连接为存活
      (ws as any).isAlive = true;

      // 监听 pong 响应
      ws.on('pong', () => {
        (ws as any).isAlive = true;
      });

      // 监听关闭事件
      ws.on('close', () => {
        console.log(`[SpectatorManager] Spectator disconnected from room ${roomId}`);
        const room = this.rooms.get(roomId);
        if (room) {
          room.delete(ws);
          // 如果房间为空，清理房间
          if (room.size === 0) {
            this.rooms.delete(roomId);
          }
        }
      });

      // 监听错误事件
      ws.on('error', (error) => {
        console.error(`[SpectatorManager] WebSocket error in room ${roomId}:`, error.message);
      });

      // 旁观者不需要处理客户端发来的消息，但记录日志以便调试
      ws.on('message', () => {
        // 忽略客户端消息，旁观者只接收
      });

      // 发送欢迎消息
      this.sendToClient(ws, 'game_start', { 
        message: 'Connected to spectator stream',
        roomId,
        spectatorCount: this.getSpectatorCount(roomId),
      });
    });

    // 启动心跳检测
    this.startHeartbeat();

    console.log('[SpectatorManager] WebSocket server initialized');
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.rooms.forEach((clients, roomId) => {
        clients.forEach((ws) => {
          if ((ws as any).isAlive === false) {
            console.log(`[SpectatorManager] Terminating inactive connection in room ${roomId}`);
            clients.delete(ws);
            ws.terminate();
            return;
          }

          (ws as any).isAlive = false;
          ws.ping();
        });

        // 清理空房间
        if (clients.size === 0) {
          this.rooms.delete(roomId);
        }
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * 向单个客户端发送消息
   */
  private sendToClient(ws: WebSocket, type: WsMessageType, data: unknown): void {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: WsMessage = {
      type,
      data,
      timestamp: Date.now(),
    };

    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('[SpectatorManager] Failed to send message:', error);
    }
  }

  /**
   * 向房间的所有旁观者广播消息
   * @param roomId 房间 ID
   * @param type 消息类型
   * @param data 消息数据
   */
  broadcast(roomId: string, type: WsMessageType, data: unknown): void {
    const clients = this.rooms.get(roomId);
    
    if (!clients || clients.size === 0) {
      return;
    }

    // 构建 WsMessage
    const message: WsMessage = {
      type,
      data,
      timestamp: Date.now(),
    };

    const messageStr = JSON.stringify(message);

    // 遍历该房间的所有连接，发送 JSON
    clients.forEach((ws) => {
      // 跳过已关闭的连接
      if (ws.readyState !== WebSocket.OPEN) {
        return;
      }

      try {
        ws.send(messageStr);
      } catch (error) {
        // broadcast 失败不应影响游戏主循环
        console.error(`[SpectatorManager] Failed to broadcast to room ${roomId}:`, error);
      }
    });
  }

  /**
   * 获取房间旁观者数量
   * @param roomId 房间 ID
   */
  getSpectatorCount(roomId: string): number {
    const clients = this.rooms.get(roomId);
    return clients ? clients.size : 0;
  }

  /**
   * 清理房间（游戏结束后）
   * @param roomId 房间 ID
   */
  cleanRoom(roomId: string): void {
    const clients = this.rooms.get(roomId);
    
    if (clients) {
      // 关闭所有连接
      clients.forEach((ws) => {
        try {
          ws.close(1000, 'Game ended');
        } catch (error) {
          // 忽略关闭错误
        }
      });
      
      // 删除房间
      this.rooms.delete(roomId);
      console.log(`[SpectatorManager] Room ${roomId} cleaned up`);
    }
  }

  /**
   * 关闭 WebSocket 服务
   */
  shutdown(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.rooms.clear();
    console.log('[SpectatorManager] WebSocket server shut down');
  }
}

// 导出单例
export const spectatorManager = new SpectatorManager();
