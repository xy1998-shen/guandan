import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { agents } from '../db/schema.js';

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      agent?: {
        id: string;
        name: string;
        callbackUrl: string;
        apiToken: string;
        createdAt: number;
        active: boolean;
      };
    }
  }
}

/**
 * Agent Token 认证中间件
 * 从 Authorization: Bearer gd_xxxx 头提取 token
 * 查询数据库验证 token
 * 将 agent 信息挂载到 req 上
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: 'Missing Authorization header',
      });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Invalid Authorization header format. Expected: Bearer <token>',
      });
      return;
    }

    const token = authHeader.slice(7); // 移除 "Bearer " 前缀

    if (!token || !token.startsWith('gd_')) {
      res.status(401).json({
        success: false,
        error: 'Invalid token format. Token should start with "gd_"',
      });
      return;
    }

    // 查询数据库验证 token
    const result = await db
      .select()
      .from(agents)
      .where(eq(agents.apiToken, token))
      .limit(1);

    if (result.length === 0) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
      return;
    }

    const agent = result[0];

    if (!agent.active) {
      res.status(403).json({
        success: false,
        error: 'Agent is deactivated',
      });
      return;
    }

    // 将 agent 信息挂载到 req 上
    req.agent = {
      id: agent.id,
      name: agent.name,
      callbackUrl: agent.callbackUrl,
      apiToken: agent.apiToken,
      createdAt: agent.createdAt,
      active: agent.active === 1,
    };

    next();
  } catch (error) {
    next(error);
  }
}
