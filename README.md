# Analytics MCP

Mastra-based agents and workflows for weather insights and payment analytics. The project sets up two agents (weather and Stripe/PayPal analytics), automated workflows, and an MCP server that exposes analytics tools.

## Features
- **Weather agent & workflow**: uses OpenRouter LLM + Open-Meteo for weather-driven activity suggestions.
- **Analytics agent & workflow**: summarizes Stripe, PayPal, and GA4 (BigQuery) performance with guardrails to avoid hallucinations.
- **MCP server**: exports analytics tools (Stripe) and the analytics agent for integration with other MCP clients.
- **Utilities**: currency conversion (exchangerate.host), time zone info, and LibSQL-backed memory.

## Prerequisites
- Node.js >= 20.9
- NPM
- API credentials: OpenRouter, Stripe, PayPal, and a GCP service account with access to the BigQuery events table.

## Environment setup
1) Copy the sample env: `cp .env.example .env.development` (or `.env.staging`/`.env.production`).
2) Fill the variables you need; the file `.env.<APP_ENV>` is picked based on `APP_ENV` (default `development`).
3) Put `GOOGLE_CLOUD_CREDENTIALS` as a single-line service account JSON; replace newline characters in the private key with `\\n`.

Key variables:
- `APP_ENV`: selects `.env.<APP_ENV>`.
- **OpenRouter**: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL_DEFAULT`, optional overrides for agent/scorer.
- **Stripe**: `STRIPE_API_KEY`, `STRIPE_BASE_URL` (optional; defaults to Stripe API).
- **PayPal**: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE_URL` (sandbox/production).
- **FX**: `FX_BASE_URL` (default exchangerate.host).
- **BigQuery GA4**: `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_CLOUD_CREDENTIALS`, `BIGQUERY_EVENTS_TABLE`, `BIGQUERY_DEV_EVENTS_TABLE`.

## Running
- Install deps: `npm install`
- Mastra dev mode: `npm run dev`
- Build: `npm run build`
- After build, start: `npm start`

Note: observability storage defaults to `:memory:`; adjust in `src/mastra/index.ts` if you need persistence.
