import type { NextFunction, Request, Response } from 'express';

export function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  console.error('[error]:', {
    method: req.method,
    url: req.originalUrl,
    message: err?.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err?.stack
  });
  const statusCode = Number(err?.statusCode) || 500;
  res.status(statusCode).json({
    message: statusCode === 500 ? 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' : err.message
  });
}
