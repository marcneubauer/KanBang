import { z } from 'zod';

const EnvSchema = z.object({
  API_PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().default('./kanbang.db'),
  SESSION_SECRET: z
    .string()
    .min(32)
    .default('dev-secret-change-in-production-min-32-chars'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  RP_ID: z.string().default('localhost'),
  RP_NAME: z.string().default('KanBang'),
  RP_ORIGIN: z.string().url().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  port: env.API_PORT,
  host: env.API_HOST,
  databaseUrl: env.DATABASE_URL,
  sessionSecret: env.SESSION_SECRET,
  cookieSecure: env.COOKIE_SECURE,
  rp: {
    id: env.RP_ID,
    name: env.RP_NAME,
    origin: env.RP_ORIGIN,
  },
  cors: {
    origin: env.CORS_ORIGIN,
  },
};
