import dotenv from 'dotenv';
import { z } from 'zod';

// Load environmental variables
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4040),
  HOST: z.string().default('127.0.0.1'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  REDIS_URL: z.string().url().default('redis://127.0.0.1:6379'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters long'),
  AUTH_SERVICE_URL: z.string().url(),
  FACULTAD_SERVICE_URL: z.string().url(),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Configuration error: invalid environmental variables:');
  console.error(JSON.stringify(parseResult.error.format(), null, 2));
  process.exit(1);
}

export const env = parseResult.data;
export type EnvType = z.infer<typeof envSchema>;
