import { app } from './app.js';
import { initDatabase } from './db/index.js';
import { spectatorManager } from './ws/spectator-manager.js';
import { startRoomCleaner } from './services/room-cleaner.js';

// 端口配置
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

/**
 * 启动服务器
 */
function startServer(): void {
  // 初始化数据库
  initDatabase();

  // 启动 HTTP 服务，保存 server 引用
  const server = app.listen(PORT, () => {
    console.log(`[Server] Guandan Arena server started`);
    console.log(`[Server] Listening on http://localhost:${PORT}`);
    console.log(`[Server] Health check: http://localhost:${PORT}/health`);
    console.log(`[Server] WebSocket endpoint: ws://localhost:${PORT}/ws/spectate/:roomId`);
  });

  // 初始化 WebSocket 服务
  spectatorManager.init(server);

  // 启动房间清理器
  startRoomCleaner();
}

// 启动服务
startServer();
