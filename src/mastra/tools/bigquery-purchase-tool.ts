import { createTool } from '@mastra/core';
import z from 'zod';
import {
  getPurchaseSessionsByDateRange,
  getDevPurchaseSessionsByDateRange,
  type PurchaseSessionDetail,
} from '../../lib/bigquery';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use format YYYY-MM-DD')
  .optional();

const purchaseSessionSchema: z.ZodType<PurchaseSessionDetail> = z.object({
  transactionId: z.string().nullable(),
  merchantOrderId: z.string().nullable(),
  paymentType: z.string().nullable(),
  currency: z.string().nullable(),
  grossRevenue: z.number().nullable(),
  taxAmount: z.number().nullable(),
  shippingAmount: z.number().nullable(),
  discountAmount: z.number().nullable(),
  couponCode: z.string().nullable(),
  affiliation: z.string().nullable(),
  userPseudoId: z.string().nullable(),
  userId: z.string().nullable(),
  gaSessionId: z.number().nullable(),
  purchaseTimestamp: z.string().nullable(),
  eventDate: z.string().nullable(),
  itemsLineCount: z.number().nullable(),
  itemsQuantity: z.number().nullable(),
  purchaseGclid: z.string().nullable(),
  purchaseDclid: z.string().nullable(),
  sessionKey: z.string().nullable(),
  sessionStartTime: z.string().nullable(),
  sessionEndTime: z.string().nullable(),
  sessionDurationSec: z.number().nullable(),
  sessionEventDate: z.string().nullable(),
  sessionEventHour: z.number().nullable(),
  sessionPageviewsCount: z.number().nullable(),
  sessionEventsCount: z.number().nullable(),
  sessionEngagementTimeMsec: z.number().nullable(),
  sessionIsEngaged: z.boolean().nullable(),
  sessionBounceLike: z.boolean().nullable(),
  sessionLandingUrl: z.string().nullable(),
  sessionLandingTitle: z.string().nullable(),
  sessionExitUrl: z.string().nullable(),
  sessionLandingPath: z.string().nullable(),
  sessionUtmSourceStart: z.string().nullable(),
  sessionUtmMediumStart: z.string().nullable(),
  sessionUtmCampaignStart: z.string().nullable(),
  sessionUtmSourceLanding: z.string().nullable(),
  sessionUtmMediumLanding: z.string().nullable(),
  sessionUtmCampaignLanding: z.string().nullable(),
  sessionUtmTermLanding: z.string().nullable(),
  sessionUtmContentLanding: z.string().nullable(),
  sessionRefSource: z.string().nullable(),
  sessionRefMedium: z.string().nullable(),
  sessionGclid: z.string().nullable(),
  sessionDclid: z.string().nullable(),
  sessionTrafficSourceType: z.string().nullable(),
  sessionTrafficSource: z.string().nullable(),
  sessionTrafficMedium: z.string().nullable(),
  sessionTrafficCampaign: z.string().nullable(),
  sessionDeviceCategory: z.string().nullable(),
  sessionOperatingSystem: z.string().nullable(),
  sessionBrowser: z.string().nullable(),
  sessionGeoCountry: z.string().nullable(),
  sessionGeoRegion: z.string().nullable(),
  sessionGeoCity: z.string().nullable(),
  sessionTransactionsCount: z.number().nullable(),
  sessionConversionFlag: z.boolean().nullable(),
  sessionHasSessionStart: z.boolean().nullable(),
  sessionUpdatedAt: z.string().nullable(),
  isRefund: z.boolean().nullable(),
  refundAmount: z.number().nullable(),
  parentTransactionId: z.string().nullable(),
  ingestedAt: z.string().nullable(),
});

export const bigqueryPurchaseSessionsTool = createTool({
  id: 'bigquery-purchase-sessions-tool',
  description: 'Fetch GA4 purchase + session details from BigQuery for the given date range.',
  inputSchema: z.object({
    startDate: dateSchema.describe('Start date (YYYY-MM-DD) in Asia/Makassar; optional'),
    endDate: dateSchema.describe('End date (YYYY-MM-DD) in Asia/Makassar; optional'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(100)
      .describe('Max rows to return across all pages (default 100, max 5000)'),
    page: z.number().int().min(1).default(1).describe('Starting page number (1-based)'),
    pageSize: z.number().int().min(1).max(5000).default(100).describe('Rows per page (max 5000)'),
    fetchAllPages: z.boolean().default(true).describe('If true, auto-fetch subsequent pages until limit reached'),
    truncateStrings: z.boolean().default(true).describe('Trim long string fields to keep payload small'),
    environment: z.enum(['default', 'dev']).default('default'),
  }),
  outputSchema: z.array(purchaseSessionSchema),
  execute: async ({ context }) => {
    const { startDate, endDate, limit, environment, page, pageSize, truncateStrings, fetchAllPages } = context;

    const fetcher =
      environment === 'dev'
        ? getDevPurchaseSessionsByDateRange
        : getPurchaseSessionsByDateRange;

    if (!fetchAllPages) {
      return fetcher({ startDate, endDate, limit, page, pageSize, truncateStrings });
    }

    const rows: PurchaseSessionDetail[] = [];
    let currentPage = page ?? 1;
    const target = limit ?? 100;
    const perPage = pageSize ?? 100;

    while (rows.length < target) {
      const batch = await fetcher({
        startDate,
        endDate,
        limit: perPage,
        page: currentPage,
        pageSize: perPage,
        truncateStrings,
      });

      if (!batch.length) break;
      rows.push(...batch);
      if (batch.length < perPage) break;
      currentPage += 1;
    }

    return rows.slice(0, target);
  },
});
