import { env } from './env';

export const config = {
  env: env.APP_ENV,
  ai_models: {
    openrouter: {
      api_key: env.OPENROUTER_API_KEY,
      models: {
        default: env.OPENROUTER_MODEL_DEFAULT,
        weatherAgent: env.OPENROUTER_MODEL_WEATHER_AGENT ?? env.OPENROUTER_MODEL_DEFAULT,
        translationScorer:
          env.OPENROUTER_MODEL_TRANSLATION_SCORER ?? env.OPENROUTER_MODEL_DEFAULT,
      },
    },
  },
  stripe: {
    api_key: env.STRIPE_API_KEY,
    base_url: env.STRIPE_BASE_URL,
  },
  paypal: {
    client_id: env.PAYPAL_CLIENT_ID,
    client_secret: env.PAYPAL_CLIENT_SECRET,
    base_url: env.PAYPAL_BASE_URL,
  },
  fx: {
    baseUrl: env.FX_BASE_URL,
  },
  gcp: {
    projectId: env.GOOGLE_CLOUD_PROJECT_ID ?? 'analytics-test-470206',
    credentials: env.GOOGLE_CLOUD_CREDENTIALS,
    eventsTable: env.BIGQUERY_EVENTS_TABLE,
    devEventsTable: env.BIGQUERY_DEV_EVENTS_TABLE,
  },
} as const;
