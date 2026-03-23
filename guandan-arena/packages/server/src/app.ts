import express, { Express } from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.js';

/**
 * 创建并配置 Express 应用
 */
export function createApp(): Express {
  const app = express();

  // 注册中间件
  app.use(cors());
  app.use(express.json());

  // 注册路由
  app.use(routes);

  // 404 处理
  app.use(notFoundMiddleware);

  // 全局错误处理
  app.use(errorMiddleware);

  return app;
}

// 导出默认 app 实例
export const app = createApp();
