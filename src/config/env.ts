import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({
  path: path.resolve(process.cwd(), `.env.${process.env.APP_ENV || 'development'}`),
});

const envSchema = z.object({
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  STRIPE_API_KEY: z.string().min(1),
  STRIPE_BASE_URL: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL_DEFAULT: z.string().min(1).default('anthropic/claude-3.5-sonnet'),
  OPENROUTER_MODEL_WEATHER_AGENT: z.string().optional(),
  OPENROUTER_MODEL_TRANSLATION_SCORER: z.string().optional(),
  PAYPAL_CLIENT_ID: z.string().min(1),
  PAYPAL_CLIENT_SECRET: z.string().min(1),
  PAYPAL_BASE_URL: z.string().min(1),
  FX_BASE_URL: z.string().default('https://api.exchangerate.host'),
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
  GOOGLE_CLOUD_CREDENTIALS: z.string().optional(),
  BIGQUERY_EVENTS_TABLE: z.string().optional(),
  BIGQUERY_DEV_EVENTS_TABLE: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
