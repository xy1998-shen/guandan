import { Request, Response, NextFunction } from 'express';

/**
 * 全局错误处理中间件
 * 捕获所有未处理错误
 * 返回统一的 ApiResponse 格式
 */
export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err);

  // 获取错误信息
  const message = err.message || 'Internal Server Error';

  // 判断是否为已知的业务错误
  const statusCode = (err as Error & { statusCode?: number }).statusCode || 500;

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}

/**
 * 404 Not Found 处理
 */
export function notFoundMiddleware(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
  });
}

/**
 * 自定义业务错误类
 */
export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}
