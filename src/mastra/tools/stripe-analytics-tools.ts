import { createTool } from '@mastra/core';
import z from 'zod';
import { getStripeCharges, type ChargeSummary } from './stripe-charge-tool';

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
  chargeCount: z.number(),
  refundedCount: z.number(),
  grossAmountMinor: z.number(),
  grossAmountMajor: z.number(),
  averageTicketMajor: z.number().nullable(),
});

const cardBrandBreakdownSchema = z.object({
  brand: z.string(),
  chargeCount: z.number(),
  grossAmountMinor: z.number(),
  grossAmountMajor: z.number(),
});

const productBreakdownSchema = z.object({
  productName: z.string(),
  chargeCount: z.number(),
  grossAmountMinor: z.number(),
  grossAmountMajor: z.number(),
});

const metadataTotalsSchema = z.record(z.string(), z.number());

const chargeSummaryOutputSchema = z.object({
  range: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
  totalCharges: z.number(),
  refundedCharges: z.number(),
  currencyBreakdown: z.array(currencyBreakdownSchema),
  cardBrandBreakdown: z.array(cardBrandBreakdownSchema),
  topProducts: z.array(productBreakdownSchema),
  metadataTotals: metadataTotalsSchema,
  insights: z.array(z.string()),
});

const topCustomerSchema = z.object({
  customerId: z.string(),
  chargeCount: z.number(),
  grossAmountMinor: z.number(),
  grossAmountMajor: z.number(),
  lastChargeId: z.string(),
  lastChargeCreated: z.number(),
  currencyBreakdown: z.array(currencyBreakdownSchema),
  metadataTotals: metadataTotalsSchema,
});

const topCustomersOutputSchema = z.object({
  range: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
  totalCustomers: z.number(),
  topCustomers: z.array(topCustomerSchema),
  insights: z.array(z.string()),
});

export const stripeChargeSummaryTool = createTool({
  id: 'stripe-charge-summary-tool',
  description: 'Summaries Stripe charge performance for a date range (totals, products, payment mix).',
  inputSchema: dateRangeSchema,
  outputSchema: chargeSummaryOutputSchema,
  execute: async ({ context }) => {
    const charges = await getStripeCharges(context.startDate, context.endDate);
    return buildChargeSummary(context.startDate, context.endDate, charges);
  },
});

export const stripeTopCustomersTool = createTool({
  id: 'stripe-top-customers-tool',
  description: 'Returns the largest customers by charge volume for a date range.',
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
    const charges = await getStripeCharges(context.startDate, context.endDate);
    return buildTopCustomersSummary(context.startDate, context.endDate, charges, context.limit ?? 5);
  },
});

function buildChargeSummary(startDate: string, endDate: string, charges: ChargeSummary[]) {
  const currencyBreakdown = aggregateByCurrency(charges);
  const cardBrandBreakdown = aggregateCardBrands(charges);
  const topProducts = aggregateProducts(charges);
  const metadataTotals = aggregateMetadataTotals(charges);
  const refundedCharges = charges.filter((charge) => charge.refunded).length;

  const summary = {
    range: { startDate, endDate },
    totalCharges: charges.length,
    refundedCharges,
    currencyBreakdown,
    cardBrandBreakdown,
    topProducts,
    metadataTotals,
  };

  return {
    ...summary,
    insights: generateChargeSummaryInsights({
      startDate,
      endDate,
      totalCharges: charges.length,
      refundedCharges,
      currencyBreakdown,
      cardBrandBreakdown,
      topProducts,
      metadataTotals,
    }),
  };
}

function buildTopCustomersSummary(
  startDate: string,
  endDate: string,
  charges: ChargeSummary[],
  limit: number,
) {
  const customerMap = new Map<
    string,
    {
      chargeCount: number;
      grossAmountMinor: number;
      lastChargeCreated: number;
      lastChargeId: string;
      charges: ChargeSummary[];
      metadataTotals: Record<string, number>;
    }
  >();

  for (const charge of charges) {
    const customerId = charge.customerId ?? 'unknown';
    const existing = customerMap.get(customerId);

    if (!existing) {
      customerMap.set(customerId, {
        chargeCount: 1,
        grossAmountMinor: charge.amount,
        lastChargeCreated: charge.created,
        lastChargeId: charge.id,
        charges: [charge],
        metadataTotals: { ...charge.metadataAmounts },
      });
      continue;
    }

    existing.chargeCount += 1;
    existing.grossAmountMinor += charge.amount;
    existing.charges.push(charge);
    existing.metadataTotals = mergeMetadataTotals(existing.metadataTotals, charge.metadataAmounts);

    if (charge.created > existing.lastChargeCreated) {
      existing.lastChargeCreated = charge.created;
      existing.lastChargeId = charge.id;
    }
  }

  const customerSummaries = Array.from(customerMap.entries())
    .map(([customerId, data]) => {
      const grossAmountMajor = sumMajorAmount(data.charges);
      const currencyBreakdown = aggregateByCurrency(data.charges);

      return {
        customerId,
        chargeCount: data.chargeCount,
        grossAmountMinor: data.grossAmountMinor,
        grossAmountMajor,
        lastChargeId: data.lastChargeId,
        lastChargeCreated: data.lastChargeCreated,
        currencyBreakdown,
        metadataTotals: data.metadataTotals,
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
type CardBrandBreakdown = z.infer<typeof cardBrandBreakdownSchema>;
type ProductBreakdown = z.infer<typeof productBreakdownSchema>;

function generateChargeSummaryInsights(params: {
  startDate: string;
  endDate: string;
  totalCharges: number;
  refundedCharges: number;
  currencyBreakdown: CurrencyBreakdown[];
  cardBrandBreakdown: CardBrandBreakdown[];
  topProducts: ProductBreakdown[];
  metadataTotals: Record<string, number>;
}): string[] {
  const {
    startDate,
    endDate,
    totalCharges,
    refundedCharges,
    currencyBreakdown,
    cardBrandBreakdown,
    topProducts,
    metadataTotals,
  } = params;

  if (totalCharges === 0) {
    return [`No successful charges were recorded between ${startDate} and ${endDate}.`];
  }

  const insights: string[] = [];
  const refundRate = totalCharges ? (refundedCharges / totalCharges) * 100 : 0;
  insights.push(
    `Processed ${totalCharges} charges from ${startDate} to ${endDate}; ${refundedCharges} (${formatPercentage(
      refundRate,
    )}) were refunded.`,
  );

  const topCurrency = currencyBreakdown[0];
  if (topCurrency) {
    const averageTicket =
      topCurrency.averageTicketMajor !== null
        ? `${formatMajor(topCurrency.averageTicketMajor)} average ticket`
        : 'average ticket unavailable';
    insights.push(
      `${topCurrency.currency.toUpperCase()} led charge volume with ${topCurrency.chargeCount} charges totaling ${formatMajor(
        topCurrency.grossAmountMajor,
      )}; ${averageTicket}.`,
    );
  }

  const topBrand = cardBrandBreakdown[0];
  if (topBrand) {
    insights.push(
      `${topBrand.brand} cards contributed ${formatMajor(topBrand.grossAmountMajor)} across ${topBrand.chargeCount} charges.`,
    );
  }

  const leadingProduct = topProducts[0];
  if (leadingProduct) {
    insights.push(
      `${leadingProduct.productName} was the top product with ${formatMajor(
        leadingProduct.grossAmountMajor,
      )} over ${leadingProduct.chargeCount} charges.`,
    );
  }

  const metadataEntries = Object.entries(metadataTotals)
    .filter(([, value]) => value !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  if (metadataEntries.length > 0) {
    const highlights = metadataEntries
      .slice(0, 2)
      .map(([key, value]) => `${key}: ${formatMajor(value)}`)
      .join(', ');
    insights.push(`Metadata totals highlight ${highlights}.`);
  }

  return insights;
}

type TopCustomerSummary = z.infer<typeof topCustomerSchema>;

function generateTopCustomerInsights(params: {
  startDate: string;
  endDate: string;
  totalCustomers: number;
  topCustomers: TopCustomerSummary[];
  limit: number;
}): string[] {
  const { startDate, endDate, totalCustomers, topCustomers, limit } = params;

  if (totalCustomers === 0) {
    return [`No customer activity detected between ${startDate} and ${endDate}.`];
  }

  const insights: string[] = [];
  const displayedCount = topCustomers.length;
  const displayedGross = topCustomers.reduce((sum, customer) => sum + customer.grossAmountMajor, 0);

  insights.push(
    `${totalCustomers} customers transacted between ${startDate} and ${endDate}; top ${displayedCount} accounted for ${formatMajor(
      displayedGross,
    )}.`,
  );

  const leader = topCustomers[0];
  if (leader) {
    const lastChargeDate = formatDate(leader.lastChargeCreated);
    insights.push(
      `Top customer ${leader.customerId} generated ${formatMajor(leader.grossAmountMajor)} across ${leader.chargeCount} charges; last purchase on ${lastChargeDate}.`,
    );

    const leaderCurrency = leader.currencyBreakdown[0];
    if (leaderCurrency) {
      insights.push(
        `${leader.customerId} primarily paid in ${leaderCurrency.currency.toUpperCase()} totaling ${formatMajor(
          leaderCurrency.grossAmountMajor,
        )}.`,
      );
    }

    const customerMetadata = Object.entries(leader.metadataTotals)
      .filter(([, value]) => value !== 0)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    if (customerMetadata.length > 0) {
      const highlight = customerMetadata
        .slice(0, 2)
        .map(([key, value]) => `${key}: ${formatMajor(value)}`)
        .join(', ');
      insights.push(`Key metadata for ${leader.customerId}: ${highlight}.`);
    }
  }

  if (totalCustomers > displayedCount) {
    insights.push(`Only top ${displayedCount} of ${totalCustomers} customers shown (limit ${limit}).`);
  }

  return insights;
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

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().split('T')[0];
}

function aggregateByCurrency(charges: ChargeSummary[]) {
  const map = new Map<
    string,
    { chargeCount: number; refundedCount: number; grossAmountMinor: number }
  >();

  for (const charge of charges) {
    const currency = charge.currency.toLowerCase();
    const entry = map.get(currency) ?? { chargeCount: 0, refundedCount: 0, grossAmountMinor: 0 };

    entry.chargeCount += 1;
    entry.grossAmountMinor += charge.amount;
    if (charge.refunded) {
      entry.refundedCount += 1;
    }

    map.set(currency, entry);
  }

  const breakdown = Array.from(map.entries()).map(([currency, entry]) => {
    const grossAmountMajor = convertToMajorUnits(entry.grossAmountMinor, currency);
    return {
      currency,
      chargeCount: entry.chargeCount,
      refundedCount: entry.refundedCount,
      grossAmountMinor: entry.grossAmountMinor,
      grossAmountMajor,
      averageTicketMajor:
        entry.chargeCount > 0 ? Number((grossAmountMajor / entry.chargeCount).toFixed(2)) : null,
    };
  });

  breakdown.sort((a, b) => b.grossAmountMajor - a.grossAmountMajor);
  return breakdown;
}

function aggregateCardBrands(charges: ChargeSummary[]) {
  const map = new Map<
    string,
    { chargeCount: number; grossAmountMinor: number; grossAmountMajor: number }
  >();

  for (const charge of charges) {
    const brand = charge.card?.brand ?? 'unknown';
    const entry =
      map.get(brand) ?? { chargeCount: 0, grossAmountMinor: 0, grossAmountMajor: 0 };
    entry.chargeCount += 1;
    entry.grossAmountMinor += charge.amount;
    entry.grossAmountMajor += convertToMajorUnits(charge.amount, charge.currency);
    map.set(brand, entry);
  }

  return Array.from(map.entries())
    .map(([brand, entry]) => ({
      brand,
      chargeCount: entry.chargeCount,
      grossAmountMinor: entry.grossAmountMinor,
      grossAmountMajor: Number(entry.grossAmountMajor.toFixed(2)),
    }))
    .sort((a, b) => b.grossAmountMajor - a.grossAmountMajor);
}

function aggregateProducts(charges: ChargeSummary[]) {
  const map = new Map<
    string,
    { chargeCount: number; grossAmountMinor: number; grossAmountMajor: number }
  >();

  for (const charge of charges) {
    const productName = charge.metadata.product_name;
    if (!productName) continue;

    const entry =
      map.get(productName) ?? { chargeCount: 0, grossAmountMinor: 0, grossAmountMajor: 0 };
    entry.chargeCount += 1;
    entry.grossAmountMinor += charge.amount;
    entry.grossAmountMajor += convertToMajorUnits(charge.amount, charge.currency);
    map.set(productName, entry);
  }

  return Array.from(map.entries())
    .map(([productName, entry]) => ({
      productName,
      chargeCount: entry.chargeCount,
      grossAmountMinor: entry.grossAmountMinor,
      grossAmountMajor: Number(entry.grossAmountMajor.toFixed(2)),
    }))
    .sort((a, b) => b.grossAmountMajor - a.grossAmountMajor)
    .slice(0, 10);
}

function aggregateMetadataTotals(charges: ChargeSummary[]) {
  return charges.reduce<Record<string, number>>((totals, charge) => {
    for (const [key, value] of Object.entries(charge.metadataAmounts)) {
      totals[key] = (totals[key] ?? 0) + value;
    }
    return totals;
  }, {});
}

function mergeMetadataTotals(
  base: Record<string, number>,
  addition: Record<string, number>,
): Record<string, number> {
  const merged = { ...base };
  for (const [key, value] of Object.entries(addition)) {
    merged[key] = (merged[key] ?? 0) + value;
  }
  return merged;
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'ugx',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
]);

function convertToMajorUnits(amount: number, currency: string): number {
  const divisor = ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase()) ? 1 : 100;
  return Number((amount / divisor).toFixed(2));
}

function sumMajorAmount(charges: ChargeSummary[]): number {
  return Number(
    charges
      .reduce((acc, charge) => acc + convertToMajorUnits(charge.amount, charge.currency), 0)
      .toFixed(2),
  );
}
