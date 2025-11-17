import { createTool } from '@mastra/core';
import z from 'zod';
import { fetchPaypalCardInfo, type CardInfoRecord } from './paypal-charge-tool';

const dateRangeSchema = z.object({
  startDate: z
    .string()
    .describe('Start date of transaction charge period (format: YYYY-MM-DD)'),
  endDate: z
    .string()
    .describe('End date of transaction charge period (format: YYYY-MM-DD)'),
});

const currencyBreakdownSchema = z.object({
  currency: z.string(),
  transactionCount: z.number(),
  refundedCount: z.number(),
  grossAmountMinor: z.number(),
  grossAmountMajor: z.number(),
  averageTicketMajor: z.number().nullable(),
});

const customerBreakdownSchema = z.object({
  customerId: z.string(),
  transactionCount: z.number(),
  grossAmountMinor: z.number(),
  grossAmountMajor: z.number(),
  lastTransactionId: z.string(),
  lastTransactionCreated: z.string(),
  currencyBreakdown: z.array(currencyBreakdownSchema),
});

const chargeSummaryOutputSchema = z.object({
  range: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
  totalTransactions: z.number(),
  refundedTransactions: z.number(),
  currencyBreakdown: z.array(currencyBreakdownSchema),
  insights: z.array(z.string()),
});

const topCustomersOutputSchema = z.object({
  range: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
  totalCustomers: z.number(),
  topCustomers: z.array(customerBreakdownSchema),
  insights: z.array(z.string()),
});

export const paypalChargeSummaryTool = createTool({
  id: 'paypal-charge-summary-tool',
  description: 'Summaries PayPal Express Checkout performance for a date range (totals, currency mix).',
  inputSchema: dateRangeSchema,
  outputSchema: chargeSummaryOutputSchema,
  execute: async ({ context }) => {
    const charges = await fetchPaypalCardInfo({
      start: parseDate(context.startDate, 'startDate', true),
      end: parseDate(context.endDate, 'endDate', false),
    });
    return buildChargeSummary(context.startDate, context.endDate, charges);
  },
});

export const paypalTopCustomersTool = createTool({
  id: 'paypal-top-customers-tool',
  description: 'Returns the largest PayPal customers by transaction volume for a date range.',
  inputSchema: dateRangeSchema.extend({
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(5)
      .describe('Number of top customers to return (1-50)'),
  }),
  outputSchema: topCustomersOutputSchema,
  execute: async ({ context }) => {
    const charges = await fetchPaypalCardInfo({
      start: parseDate(context.startDate, 'startDate', true),
      end: parseDate(context.endDate, 'endDate', false),
    });

    return buildTopCustomersSummary(context.startDate, context.endDate, charges, context.limit ?? 5);
  },
});

function buildChargeSummary(startDate: string, endDate: string, charges: CardInfoRecord[]) {
  const currencyBreakdown = aggregateByCurrency(charges);
  const refundedTransactions = charges.filter((charge) => isRefunded(charge.status)).length;

  const summary = {
    range: { startDate, endDate },
    totalTransactions: charges.length,
    refundedTransactions,
    currencyBreakdown,
  };

  return {
    ...summary,
    insights: generateChargeSummaryInsights({
      startDate,
      endDate,
      totalTransactions: charges.length,
      refundedTransactions,
      currencyBreakdown,
    }),
  };
}

function buildTopCustomersSummary(
  startDate: string,
  endDate: string,
  charges: CardInfoRecord[],
  limit: number,
) {
  const customerMap = new Map<
    string,
    {
      transactionCount: number;
      grossAmountMinor: number;
      grossAmountMajor: number;
      lastTransactionId: string;
      lastTransactionCreated: string;
      charges: CardInfoRecord[];
    }
  >();

  for (const charge of charges) {
    const customerId = deriveCustomerId(charge);
    const existing = customerMap.get(customerId);

    if (!existing) {
      customerMap.set(customerId, {
        transactionCount: 1,
        grossAmountMinor: charge.amountMinor,
        grossAmountMajor: charge.amountMajor,
        lastTransactionId: charge.transactionId,
        lastTransactionCreated: charge.createdAtUtc,
        charges: [charge],
      });
      continue;
    }

    existing.transactionCount += 1;
    existing.grossAmountMinor += charge.amountMinor;
    existing.grossAmountMajor += charge.amountMajor;
    existing.charges.push(charge);

    if (new Date(charge.createdAtUtc).getTime() > new Date(existing.lastTransactionCreated).getTime()) {
      existing.lastTransactionCreated = charge.createdAtUtc;
      existing.lastTransactionId = charge.transactionId;
    }
  }

  const customerSummaries = Array.from(customerMap.entries())
    .map(([customerId, data]) => {
      const currencyBreakdown = aggregateByCurrency(data.charges);

      return {
        customerId,
        transactionCount: data.transactionCount,
        grossAmountMinor: data.grossAmountMinor,
        grossAmountMajor: Number(data.grossAmountMajor.toFixed(2)),
        lastTransactionId: data.lastTransactionId,
        lastTransactionCreated: data.lastTransactionCreated,
        currencyBreakdown,
      };
    })
    .sort((a, b) => b.grossAmountMajor - a.grossAmountMajor)
    .slice(0, limit);

  const summary = {
    range: { startDate, endDate },
    totalCustomers: customerMap.size,
    topCustomers: customerSummaries,
  };

  return {
    ...summary,
    insights: generateTopCustomerInsights({
      startDate,
      endDate,
      totalCustomers: customerMap.size,
      topCustomers: customerSummaries,
      limit,
    }),
  };
}

type CurrencyBreakdown = z.infer<typeof currencyBreakdownSchema>;
type TopCustomerSummary = z.infer<typeof customerBreakdownSchema>;

function generateChargeSummaryInsights(params: {
  startDate: string;
  endDate: string;
  totalTransactions: number;
  refundedTransactions: number;
  currencyBreakdown: CurrencyBreakdown[];
}): string[] {
  const { startDate, endDate, totalTransactions, refundedTransactions, currencyBreakdown } = params;

  if (totalTransactions === 0) {
    return [`No PayPal transactions recorded between ${startDate} and ${endDate}.`];
  }

  const insights: string[] = [];
  const refundRate = totalTransactions ? (refundedTransactions / totalTransactions) * 100 : 0;
  insights.push(
    `Processed ${totalTransactions} PayPal transactions from ${startDate} to ${endDate}; ${refundedTransactions} (${formatPercentage(
      refundRate,
    )}) were refunded or reversed.`,
  );

  const topCurrency = currencyBreakdown[0];
  if (topCurrency) {
    const averageTicket =
      topCurrency.averageTicketMajor !== null
        ? `${formatMajor(topCurrency.averageTicketMajor)} average ticket`
        : 'average ticket unavailable';
    insights.push(
      `${topCurrency.currency.toUpperCase()} led PayPal volume with ${topCurrency.transactionCount} transactions totaling ${formatMajor(
        topCurrency.grossAmountMajor,
      )}; ${averageTicket}.`,
    );
  }

  return insights;
}

function generateTopCustomerInsights(params: {
  startDate: string;
  endDate: string;
  totalCustomers: number;
  topCustomers: TopCustomerSummary[];
  limit: number;
}): string[] {
  const { startDate, endDate, totalCustomers, topCustomers, limit } = params;

  if (totalCustomers === 0) {
    return [`No PayPal customer activity detected between ${startDate} and ${endDate}.`];
  }

  const insights: string[] = [];
  const displayedCount = topCustomers.length;
  const displayedGross = topCustomers.reduce((sum, customer) => sum + customer.grossAmountMajor, 0);

  insights.push(
    `${totalCustomers} PayPal customers transacted between ${startDate} and ${endDate}; top ${displayedCount} accounted for ${formatMajor(
      Number(displayedGross.toFixed(2)),
    )}.`,
  );

  const leader = topCustomers[0];
  if (leader) {
    const lastDate = formatDate(leader.lastTransactionCreated);
    insights.push(
      `Top customer ${leader.customerId} contributed ${formatMajor(
        leader.grossAmountMajor,
      )} across ${leader.transactionCount} transactions; last activity ${lastDate}.`,
    );
  }

  if (totalCustomers > limit && displayedCount > 0) {
    insights.push(`Additional ${totalCustomers - displayedCount} customers generated the remainder of volume.`);
  }

  return insights;
}

function aggregateByCurrency(charges: CardInfoRecord[]) {
  const map = new Map<
    string,
    { transactionCount: number; refundedCount: number; grossAmountMinor: number; grossAmountMajor: number }
  >();

  for (const charge of charges) {
    const currency = (charge.currency ?? 'USD').toUpperCase();
    const entry =
      map.get(currency) ?? { transactionCount: 0, refundedCount: 0, grossAmountMinor: 0, grossAmountMajor: 0 };

    entry.transactionCount += 1;
    entry.grossAmountMinor += charge.amountMinor;
    entry.grossAmountMajor += charge.amountMajor;
    entry.refundedCount += isRefunded(charge.status) ? 1 : 0;

    map.set(currency, entry);
  }

  const breakdown = Array.from(map.entries()).map(([currency, entry]) => ({
    currency,
    transactionCount: entry.transactionCount,
    refundedCount: entry.refundedCount,
    grossAmountMinor: entry.grossAmountMinor,
    grossAmountMajor: Number(entry.grossAmountMajor.toFixed(2)),
    averageTicketMajor:
      entry.transactionCount > 0 ? Number((entry.grossAmountMajor / entry.transactionCount).toFixed(2)) : null,
  }));

  breakdown.sort((a, b) => b.grossAmountMajor - a.grossAmountMajor);
  return breakdown;
}

function isRefunded(status: string | null): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return normalized.includes('refund') || normalized === 'reversed' || normalized === 'cancelled';
}

function deriveCustomerId(charge: CardInfoRecord): string {
  return charge.customerEmail ?? charge.customerPhone ?? 'unknown';
}

function parseDate(date: string, field: 'startDate' | 'endDate', isStart: boolean): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new Error(`Invalid ${field} supplied. Expected format YYYY-MM-DD, received: ${date}`);
  }

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const day = Number(dayStr);

  const ms = isStart
    ? Date.UTC(year, monthIndex, day, 0, 0, 0, 0)
    : Date.UTC(year, monthIndex, day, 23, 59, 59, 999);

  if (Number.isNaN(ms)) {
    throw new Error(`Invalid ${field} supplied. Expected format YYYY-MM-DD, received: ${date}`);
  }

  return new Date(ms);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatMajor(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().slice(0, 10);
}
