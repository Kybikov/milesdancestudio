import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  SETTINGS_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  COOKIE_DOMAIN: z.string().optional(),
  OWNER_EMAIL: z.string().email().default("owner@miles.local"),
  OWNER_PASSWORD: z.string().min(12),
  ADMIN_EMAIL: z.string().email().default("admin@miles.local"),
  ADMIN_PASSWORD: z.string().min(12),
});

export const env = schema.parse(process.env);
