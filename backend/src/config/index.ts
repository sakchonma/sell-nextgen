import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5001),
  MONGODB_URI: z.string().trim().min(1).default('mongodb://localhost:27017'),
  MONGODB_DB_NAME: z.string().trim().min(1).default('sell_nextgen_db'),
  GEMINI_API_KEY: z.string().optional().default(''),
  JWT_SECRET: z.string().optional(),
  CORS_ORIGIN: z.string().optional().default('http://localhost:5173,http://localhost:3001'),
  ALLOW_MEMORY_DB: z.string().optional()
}).superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production') {
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'Production requires JWT_SECRET length >= 32' });
    }
    if (!env.MONGODB_URI.startsWith('mongodb')) {
      ctx.addIssue({ code: 'custom', path: ['MONGODB_URI'], message: 'Production requires a MongoDB URI' });
    }
  }
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error('[config]: Invalid environment variables', parsedEnv.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const config = {
  port: parsedEnv.data.PORT,
  mongodb: {
    uri: parsedEnv.data.MONGODB_URI,
    dbName: parsedEnv.data.MONGODB_DB_NAME,
  },
  gemini: {
    apiKey: parsedEnv.data.GEMINI_API_KEY,
  },
  corsOrigins: parsedEnv.data.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean),
  env: parsedEnv.data.NODE_ENV,
};
