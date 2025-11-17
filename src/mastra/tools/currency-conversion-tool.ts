import { createTool } from '@mastra/core';
import z from 'zod';
import { config } from '../../config';

const FX_BASE_URL = config.fx.baseUrl.replace(/\/$/, '');

const inputSchema = z.object({
  currency: z.string().describe('Three-letter currency code to convert from (e.g. JPY, THB, EUR, USD)'),
  amount: z.number().describe('Amount in source currency (major units)'),
  overrideRates: z
    .record(z.string().min(1), z.number().positive())
    .optional()
    .describe('Optional override map of USD rates, e.g. { "JPY": 0.0064 }'),
});

const outputSchema = z.object({
  currency: z.string(),
  amount: z.number(),
  usdAmount: z.number(),
  rateUsed: z.number(),
  rateSource: z.enum(['override', 'config', 'remote', 'default']),
});

export const currencyConversionTool = createTool({
  id: 'currency-conversion-tool',
  description: 'Convert a non-USD amount into USD using override rates or live rates from exchangerate.host.',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const currency = context.currency.toUpperCase();
    const amount = context.amount;
    const overrideRates = normalizeRates(context.overrideRates ?? {});
    const { rates, source: rateSource } = await resolveRates(overrideRates);
    const { rate, source } = resolveRate(currency, rates, rateSource);
    const usdAmount = Number((amount * rate).toFixed(2));

    return {
      currency,
      amount,
      usdAmount,
      rateUsed: rate,
      rateSource: source,
    };
  },
});

function normalizeRates(raw: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(raw).flatMap(([key, value]) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) return [];
      return [[key.toUpperCase(), numeric]];
    }),
  );
}

async function resolveRates(
  overrides: Record<string, unknown>,
): Promise<{ rates: Record<string, number>; source: 'override' | 'remote' }> {
  if (Object.keys(overrides).length > 0) {
    return { rates: normalizeRates(overrides), source: 'override' };
  }

  const remoteRates = await fetchUsdRates();
  return { rates: remoteRates, source: 'remote' };
}

function resolveRate(
  currency: string,
  rates: Record<string, number>,
  source: 'override' | 'remote',
): { rate: number; source: 'override' | 'remote' | 'default' } {
  if (currency === 'USD') {
    return { rate: 1, source: 'default' };
  }

  if (currency in rates) {
    return { rate: rates[currency], source };
  }

  throw new Error(
    `No USD conversion rate available for ${currency}. Provide overrideRates or set USD_CONVERSION_RATES env JSON.`,
  );
}

async function fetchUsdRates(): Promise<Record<string, number>> {
  const url = `${FX_BASE_URL}/latest?base=USD`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch FX rates from exchangerate.host: ${response.status}`);
  }

  const bodyText = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new Error(`Unexpected FX response from exchangerate.host (non-JSON): ${bodyText.slice(0, 200)}`);
  }

  const rates = typeof data === 'object' && data !== null && 'rates' in data ? (data as { rates: unknown }).rates : null;
  if (!rates || typeof rates !== 'object') {
    throw new Error(
      `Unexpected FX response shape from exchangerate.host: ${bodyText.slice(0, 200)}`
    );
  }

  const normalized = normalizeRates(rates as Record<string, unknown>);
  if (Object.keys(normalized).length === 0) {
    throw new Error(
      `No usable FX rates returned from exchangerate.host: ${bodyText.slice(0, 200)}`
    );
  }

  return normalized;
}
