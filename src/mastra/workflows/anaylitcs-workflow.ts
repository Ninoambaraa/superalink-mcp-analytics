import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { getStripeCharges, chargeSummarySchema } from '../tools/stripe-charge-tool';
import { getCurrentIsoTime } from '../tools/current-time-tool';
import { fetchPaypalCardInfo, cardInfoRecordSchema } from '../tools/paypal-charge-tool';

const analyticsInputSchema = z.object({
  startDate: z
    .string()
    .describe('Start of the analysis window (format: YYYY-MM-DD)')
    .optional(),
  endDate: z
    .string()
    .describe('End of the analysis window (format: YYYY-MM-DD)')
    .optional(),
  question: z
    .string()
    .describe('Optional business question or hypothesis to investigate')
    .optional(),
});

const resolvedDateRangeSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  question: z.string().optional(),
});

const chargeAnalysisPayloadSchema = resolvedDateRangeSchema.extend({
  stripeCharges: z.array(chargeSummarySchema),
  paypalCharges: z.array(cardInfoRecordSchema),
});

const resolveDateRange = createStep({
  id: 'resolve-date-range',
  description: 'Ensures a valid start/end window, defaulting to the last 7 days when missing.',
  inputSchema: analyticsInputSchema,
  outputSchema: resolvedDateRangeSchema,
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const { startDate, endDate, question } = inputData;
    const nowIso = await getCurrentIsoTime();
    const today = new Date(nowIso);

    const resolved = computeDateRange({
      startDate,
      endDate,
      today,
    });

    return {
      ...resolved,
      question,
    };
  },
});

const fetchStripeCharges = createStep({
  id: 'fetch-stripe-charges',
  description: 'Fetch Stripe charges for the requested date range.',
  inputSchema: resolvedDateRangeSchema,
  outputSchema: resolvedDateRangeSchema.extend({
    stripeCharges: z.array(chargeSummarySchema),
  }),
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const { startDate, endDate, question } = inputData;

    const start = Date.parse(startDate);
    const end = Date.parse(endDate);

    if (Number.isNaN(start) || Number.isNaN(end)) {
      throw new Error('Invalid date supplied. Use format YYYY-MM-DD.');
    }

    if (end < start) {
      throw new Error('endDate must be on or after startDate.');
    }

    const stripeCharges = await getStripeCharges(startDate, endDate);

    return {
      startDate,
      endDate,
      question,
      stripeCharges,
    };
  },
});

const fetchPaypalCharges = createStep({
  id: 'fetch-paypal-charges',
  description: 'Fetch PayPal Express Checkout transactions for the requested date range.',
  inputSchema: resolvedDateRangeSchema.extend({
    stripeCharges: z.array(chargeSummarySchema),
  }),
  outputSchema: chargeAnalysisPayloadSchema,
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const { startDate, endDate, question, stripeCharges } = inputData;

    const start = Date.parse(startDate);
    const end = Date.parse(endDate);

    if (Number.isNaN(start) || Number.isNaN(end)) {
      throw new Error('Invalid date supplied. Use format YYYY-MM-DD.');
    }

    if (end < start) {
      throw new Error('endDate must be on or after startDate.');
    }

    const paypalCharges = await fetchPaypalCardInfo({
      start: new Date(start),
      end: new Date(end),
    });

    return {
      startDate,
      endDate,
      question,
      stripeCharges,
      paypalCharges,
    };
  },
});

const analyzeStripeCharges = createStep({
  id: 'analyze-stripe-charges',
  description: 'Generate an analytics summary from the retrieved Stripe and PayPal data.',
  inputSchema: chargeAnalysisPayloadSchema,
  outputSchema: z.object({
    report: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Charge data not provided.');
    }

    const agent = mastra?.getAgent('analyticsAgent');

    if (!agent) {
      throw new Error('Analytics agent is not registered.');
    }

    const { startDate, endDate, question, stripeCharges, paypalCharges } = inputData;

    const questionPrompt =
      question ??
      'Provide a concise revenue and customer performance update for operations leaders.';

    const guardrails = `
      - If both providers have zero records, clearly state that no historical transactions exist for the requested window (even if in the future) and suggest checking an alternate past range.
      - Otherwise, include total transaction count and gross volume per provider; call out notable refunds and mix by currency.
      - Reference exact numbers from the payload; never fabricate amounts or currencies.
      - When comparing currencies, use the currencyConversionTool to express amounts in USD.
      - Keep the response focused, actionable, and under 250 words.
    `;

    const payloadPreview = JSON.stringify(
      {
        stripeCharges,
        paypalCharges,
      },
      null,
      2,
    );

    const response = await agent.stream([
      {
        role: 'user',
        content: `
          You are collaborating with Superalink's analytics team. You have Stripe and PayPal data for the same window.

          Date range: ${startDate} to ${endDate}
          Business question: ${questionPrompt}

          Stripe + PayPal payload preview (trimmed):
          ${payloadPreview}

          Guidelines:
          ${guardrails}
        `,
      },
    ]);

    let report = '';

    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
      report += chunk;
    }

    return { report };
  },
});

type DateRangeInput = {
  startDate?: string;
  endDate?: string;
  today: Date;
};

type DateRange = {
  startDate: string;
  endDate: string;
};

function computeDateRange({ startDate, endDate, today }: DateRangeInput): DateRange {
  const todayStart = startOfUTCDate(today);

  if (startDate && endDate) {
    const start = parseISODate(startDate, 'startDate');
    const end = parseISODate(endDate, 'endDate');
    ensureChronology(start, end);
    ensureNotFuture(start, todayStart, 'startDate');
    ensureNotFuture(end, todayStart, 'endDate');
    return { startDate: formatISODate(start), endDate: formatISODate(end) };
  }

  if (startDate && !endDate) {
    const start = parseISODate(startDate, 'startDate');
    ensureNotFuture(start, todayStart, 'startDate');
    const tentativeEnd = addDays(start, 6);
    const end = tentativeEnd > todayStart ? todayStart : tentativeEnd;
    ensureChronology(start, end);
    return { startDate: formatISODate(start), endDate: formatISODate(end) };
  }

  if (!startDate && endDate) {
    const end = parseISODate(endDate, 'endDate');
    ensureNotFuture(end, todayStart, 'endDate');
    const start = addDays(end, -6);
    return { startDate: formatISODate(start), endDate: formatISODate(end) };
  }

  const end = todayStart;
  const start = addDays(end, -6);
  return { startDate: formatISODate(start), endDate: formatISODate(end) };
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseISODate(value: string, field: 'startDate' | 'endDate'): Date {
  if (!ISO_DATE_REGEX.test(value)) {
    throw new Error(`Invalid ${field}. Expected format YYYY-MM-DD, received: ${value}`);
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(timestamp)) {
    throw new Error(`Invalid ${field}. Unable to parse date: ${value}`);
  }
  return new Date(timestamp);
}

function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const clone = new Date(date);
  clone.setUTCDate(clone.getUTCDate() + days);
  return clone;
}

function ensureChronology(start: Date, end: Date) {
  if (end < start) {
    throw new Error('endDate must be on or after startDate.');
  }
}

function ensureNotFuture(date: Date, today: Date, field: 'startDate' | 'endDate') {
  if (date > today) {
    throw new Error(`${field} cannot be in the future.`);
  }
}

function startOfUTCDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

const analyticsWorkflow = createWorkflow({
  id: 'analytics-workflow',
  description: 'Analyzes Stripe and PayPal transaction performance over a date range.',
  inputSchema: analyticsInputSchema,
  outputSchema: z.object({
    report: z.string(),
  }),
})
  .then(resolveDateRange)
  .then(fetchStripeCharges)
  .then(fetchPaypalCharges)
  .then(analyzeStripeCharges);

analyticsWorkflow.commit();

export { analyticsWorkflow };
