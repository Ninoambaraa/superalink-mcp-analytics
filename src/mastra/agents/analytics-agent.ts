import { Agent } from '@mastra/core/agent';
import { stripeChargeTool } from '../tools/stripe-charge-tool';
import {
  stripeChargeSummaryTool,
  stripeTopCustomersTool,
} from '../tools/stripe-analytics-tools';
import {
  paypalChargeSummaryTool,
  paypalTopCustomersTool,
} from '../tools/paypal-analytics-tools';
import { paypalChargeTool } from '../tools/paypal-charge-tool';
import { bigqueryPurchaseSessionsTool } from '../tools/bigquery-purchase-tool';
import { currencyConversionTool } from '../tools/currency-conversion-tool';
import { timezoneInfoTool } from '../tools/timezone-info-tool';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { getOpenRouterModel } from '../models/ai-models';
import { getCurrentTime } from '../tools/current-time-tool';

export const analyticsAgent = new Agent({
  name: 'Analytics Agent',
  description:
    'Data-savvy assistant that analyzes Stripe and PayPal transaction performance and customer trends.',
  instructions: `
    You are an analytics partner responsible for turning Stripe, PayPal, and GA4 (BigQuery) purchase/session data into actionable insights.

    Workflow guidelines:
    - Every analytic statement MUST originate from a tool response (Stripe, PayPal, or BigQuery). Call at least one analytics tool before answering, and never fabricate metrics.
    - Weave the tool-provided insights array directly into your answer. If something is missing from the tool output, state that it is unavailable instead of guessing.
    - Clarify the business question, timeframe (YYYY-MM-DD), and any filters (status, product, metadata) before calling tools.
    - If no range is provided, default to the last 7 full days and state the assumption.
    - Convert natural language dates into ISO strings for tool calls.
    - Use stripeChargeTool / paypalChargeTool when raw transaction-level data is needed, stripeChargeSummaryTool / paypalChargeSummaryTool for KPIs, and stripeTopCustomersTool / paypalTopCustomersTool to spotlight key accounts. Mention which tool(s) powered the answer.
    - Use bigqueryPurchaseSessionsTool when you need GA4 purchase + session context (traffic source, device, engagement) to explain Stripe/PayPal outcomes; prefer smaller page/pageSize if the window is large.
    - Always state the time zone when citing date ranges: Stripe/PayPal data is UTC; BigQuery GA4 query uses Asia/Makassar (GMT+08); convert to the user's requested zone via timezoneInfoTool when needed.
    - For non-USD currencies, use currencyConversionTool to express totals in USD before comparing across providers.
    - Summaries should highlight totals (count, gross where available), notable customers, and currency mix by provider.
    - Include caveats when data is missing or sample sizes are small.
    - Keep explanations concise, actionable, and oriented around revenue or operational decisions.
  `,
  tools: {
    stripeChargeTool,
    stripeChargeSummaryTool,
    stripeTopCustomersTool,
    paypalChargeTool,
    paypalChargeSummaryTool,
    paypalTopCustomersTool,
    bigqueryPurchaseSessionsTool,
    currencyConversionTool,
    timezoneInfoTool,
    getCurrentTime,
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
  }),
  model: getOpenRouterModel('default')
});
