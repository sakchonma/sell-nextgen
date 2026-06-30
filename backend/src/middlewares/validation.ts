import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';

export function validateBody(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: 'ข้อมูลที่ส่งมาไม่ถูกต้อง',
        errors: parsed.error.issues.map(issue => ({
          field: issue.path.join('.') || 'body',
          message: issue.message
        }))
      });
      return;
    }
    req.body = parsed.data;
    next();
  };
}
