import { createTool } from '@mastra/core';
import z from 'zod';
import type Stripe from 'stripe';
import { stripe } from '../../lib/stripe';

type Nullable<T> = { [K in keyof T]: T[K] | null };

export type CardSummary = Nullable<
  Pick<
    Stripe.Charge.PaymentMethodDetails.Card,
    'brand' | 'country' | 'exp_month' | 'exp_year' | 'last4' | 'funding'
  >
>;

type MetadataAmounts = Record<string, number>;

export type ChargeSummary = Pick<
  Stripe.Charge,
  'id' | 'amount' | 'currency' | 'status' | 'description' | 'created' | 'refunded'
> & {
  customerId: string | null;
  receiptUrl: string | null;
  card: CardSummary | null;
  paymentMethodDetails: Stripe.Charge.PaymentMethodDetails | null;
  metadata: Stripe.Metadata;
  metadataAmounts: MetadataAmounts;
};

export const cardSummarySchema = z.object({
  brand: z.string().nullable(),
  country: z.string().nullable(),
  exp_month: z.number().nullable(),
  exp_year: z.number().nullable(),
  last4: z.string().nullable(),
  funding: z.string().nullable(),
});

export const chargeSummarySchema = z.object({
  id: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.string().nullable(),
  description: z.string().nullable(),
  customerId: z.string().nullable(),
  created: z.number(),
  refunded: z.boolean(),
  receiptUrl: z.string().nullable(),
  card: cardSummarySchema.nullable(),
  paymentMethodDetails: z.unknown().nullable(),
  metadata: z.record(z.string(), z.string()),
  metadataAmounts: z.record(z.number(),z.number()),
});

export const stripeChargeTool = createTool({
  id: 'stripe-charge-tool',
  description: 'Get Stripe Charge trx for data range',
  inputSchema: z.object({
    startDate: z
      .string()
      .describe('Start date of transaction charge period (format: YYYY-MM-DD)'),
    endDate: z
      .string()
      .describe('End date of transaction charge period (format: YYYY-MM-DD)'),
  }), 
  outputSchema: z.array(chargeSummarySchema),
  execute: async ({ context }) => {
    return getStripeCharges(context.startDate, context.endDate);
  },
});

export async function getStripeCharges(startDate: string, endDate: string): Promise<ChargeSummary[]> {
  try {
  const startTimestamp = parseDateToUnix(startDate, 'startDate');
  const endTimestamp = parseDateToUnix(endDate, 'endDate');

  if (endTimestamp < startTimestamp) {
    throw new Error('endDate must be after startDate');
  }

  const params: Stripe.ChargeListParams = {
    limit: 100,
    created: {
      gte: startTimestamp,
      lte: endTimestamp,
    },
  };
  
  const charges: ChargeSummary[] = [];

  for await (const charge of stripe.charges.list(params)) {
    if (charge.status !== 'succeeded') {
      continue;
    }
    const metadataAmounts = extractMetadataAmounts(charge.metadata);

    charges.push({
      id: charge.id,
      amount: charge.amount,
      currency: charge.currency,
      status: charge.status,
      description: charge.description,
      customerId:
        typeof charge.customer === 'string'
          ? charge.customer
          : charge.customer?.id ?? null,
      created: charge.created,
      refunded: charge.refunded ?? false,
      receiptUrl: charge.receipt_url ?? null,
      card: toCardSummary(charge.payment_method_details?.card ?? null),
      paymentMethodDetails: charge.payment_method_details ?? null,
      metadata: charge.metadata,
      metadataAmounts,
    });
  }

  return charges;
  } catch (error) {
    console.error(error)
    return []
  }
  
}

function parseDateToUnix(date: string, field: 'startDate' | 'endDate'): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new Error(`Invalid ${field} supplied. Expected format YYYY-MM-DD, received: ${date}`);
  }

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const day = Number(dayStr);

  const utcMs =
    field === 'startDate'
      ? Date.UTC(year, monthIndex, day, 0, 0, 0, 0)
      : Date.UTC(year, monthIndex, day, 23, 59, 59, 999);

  if (Number.isNaN(utcMs)) {
    throw new Error(`Invalid ${field} supplied. Expected format YYYY-MM-DD, received: ${date}`);
  }

  return Math.floor(utcMs / 1000);
}

function toCardSummary(
  card: Stripe.Charge.PaymentMethodDetails.Card | null,
): CardSummary | null {
  if (!card) {
    return null;
  }

  return {
    brand: card.brand ?? null,
    country: card.country ?? null,
    exp_month: card.exp_month ?? null,
    exp_year: card.exp_year ?? null,
    last4: card.last4 ?? null,
    funding: card.funding ?? null,
  };
}

const CENT_VALUE_KEYS = new Set([
  'gross',
  'net',
  'product_gross',
  'product_net',
  'product_total',
  'total_additions',
  'total_cuts',
  'price',
  'amount',
  'subtotal',
  'tax',
  'fee',
]);

const CENT_SUFFIXES = ['_gross', '_net', '_total', '_amount', '_price', '_subtotal', '_tax', '_fee'];

function extractMetadataAmounts(metadata: Stripe.Metadata): MetadataAmounts {
  const amounts: MetadataAmounts = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (!value) continue;
    if (!isCentKey(key)) continue;

    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      continue;
    }

    amounts[key] = numeric / 100;
  }

  return amounts;
}

function isCentKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (CENT_VALUE_KEYS.has(normalized)) {
    return true;
  }

  return CENT_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}
