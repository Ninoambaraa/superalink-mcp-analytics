import { createTool } from '@mastra/core';
import z from 'zod';
import { config } from '../../config';
import { getPaypalAccessToken } from '../../lib/paypal';

const PAYPAL_API_BASE = config.paypal.base_url.replace(/\/$/, '');
const EXPRESS_CHECKOUT_EVENT_CODES = new Set(['T0006', 'T1106', 'T1006']);

export interface PaypalPhone {
  national_number?: string | null;
  extension_number?: string | null;
  phone_type?: string | null;
  area_code?: string | null;
}

export interface PaypalAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  country_code?: string | null;
  postal_code?: string | null;
  admin_area_1?: string | null;
  admin_area_2?: string | null;
}

export interface PaypalTransactionDetail {
  transaction_info?: {
    transaction_id?: string | null;
    paypal_reference_id?: string | null;
    paypal_reference_id_type?: string | null;
    transaction_event_code?: string | null;
    transaction_event_code_description?: string | null;
    transaction_status?: string | null;
    transaction_initiation_date?: string | null;
    transaction_updated_date?: string | null;
    transaction_amount?: {
      currency_code?: string | null;
      value?: string | null;
    } | null;
    invoice_id?: string | null;
    custom_field?: string | null;
  } | null;
  payer_info?: {
    email_address?: string | null;
    account_id?: string | null;
    trx_id?: string | null;
    phone?: string | null;
    phone_number?: PaypalPhone | null;
    first_name?: string | null;
    last_name?: string | null;
    middle_name?: string | null;
    country_code?: string | null;
    address?: PaypalAddress | null;
  } | null;
  shipping_info?: {
    name?: string | null;
    address?: PaypalAddress | null;
  } | null;
}

export interface CardInfoRecord {
  provider: 'paypal';
  orderId: string;
  transactionId: string;
  amountMinor: number;
  amountMajor: number;
  createdAtUtc: string;
  status: string | null;
  currency: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  city: string | null;
  addressCountry: string | null;
  issueCountry: string | null;
  cardBrand: string | null;
  cardFunding: string | null;
  cardTokenization: string | null;
  cardLast4: string | null;
  avsLine1: string | null;
  avsZip: string | null;
  cvcStatus: string | null;
}

export const cardInfoRecordSchema = z.object({
  provider: z.literal('paypal'),
  orderId: z.string(),
  transactionId: z.string(),
  amountMinor: z.number(),
  amountMajor: z.number(),
  createdAtUtc: z.string(),
  status: z.string().nullable(),
  currency: z.string().nullable(),
  customerEmail: z.string().nullable(),
  customerPhone: z.string().nullable(),
  city: z.string().nullable(),
  addressCountry: z.string().nullable(),
  issueCountry: z.string().nullable(),
  cardBrand: z.string().nullable(),
  cardFunding: z.string().nullable(),
  cardTokenization: z.string().nullable(),
  cardLast4: z.string().nullable(),
  avsLine1: z.string().nullable(),
  avsZip: z.string().nullable(),
  cvcStatus: z.string().nullable(),
});

const dateRangeSchema = z.object({
  startDate: z
    .string()
    .describe('Start date of transaction charge period (format: YYYY-MM-DD)'),
  endDate: z
    .string()
    .describe('End date of transaction charge period (format: YYYY-MM-DD)'),
});

const toNullableString = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toUpper = (value?: string | null): string | null => {
  const nullable = toNullableString(value);
  return nullable ? nullable.toUpperCase() : null;
};

const normalizePhone = (phone?: PaypalPhone | string | null): string | null => {
  if (!phone) return null;
  if (typeof phone === 'string') {
    return toNullableString(phone);
  }
  const national = toNullableString(phone.national_number);
  const extension = toNullableString(phone.extension_number);
  if (national && extension) {
    return `${national} ext ${extension}`;
  }
  return national ?? extension;
};

const isExpressCheckoutPayment = (detail: PaypalTransactionDetail): boolean => {
  const codeRaw = detail.transaction_info?.transaction_event_code;
  if (codeRaw) {
    const code = codeRaw.toUpperCase();
    if (EXPRESS_CHECKOUT_EVENT_CODES.has(code)) {
      return true;
    }
  }

  const description = detail.transaction_info?.transaction_event_code_description;
  if (
    typeof description === 'string' &&
    description.toLowerCase().includes('express checkout payment')
  ) {
    return true;
  }

  return false;
};

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

const normalizeAmount = (
  transactionAmount?: PaypalTransactionDetail['transaction_info'] extends { transaction_amount?: infer T }
    ? T
    : unknown,
): { minor: number; major: number } => {
  const valueRaw = typeof transactionAmount === 'object' && transactionAmount
    ? (transactionAmount as { value?: string | null; currency_code?: string | null }).value
    : null;
  const currency = typeof transactionAmount === 'object' && transactionAmount
    ? (transactionAmount as { currency_code?: string | null }).currency_code
    : null;

  const numeric = typeof valueRaw === 'string' ? Number.parseFloat(valueRaw) : Number.NaN;
  const normalizedCurrency = toUpper(currency) ?? 'USD';

  if (!Number.isFinite(numeric) || numeric < 0) {
    return { minor: 0, major: 0 };
  }

  const divisor = ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency.toLowerCase()) ? 1 : 100;
  const minor = Math.round(numeric * divisor);
  const major = Number((minor / divisor).toFixed(2));

  return { minor, major };
};

const mapPaypalTransactionToCardInfo = (
  detail: PaypalTransactionDetail,
): CardInfoRecord | null => {
  if (!isExpressCheckoutPayment(detail)) {
    return null;
  }

  const info = detail.transaction_info ?? {};
  const payer = detail.payer_info ?? {};
  const shipping = detail.shipping_info ?? {};
  const amount = normalizeAmount(info.transaction_amount);

  const transactionId = toNullableString(info.transaction_id);
  if (!transactionId) {
    return null;
  }

  const orderId =
    toNullableString(info.invoice_id) ?? toNullableString(info.custom_field);
  if (!orderId) {
    return null;
  }

  const initiationDate = info.transaction_initiation_date
    ? new Date(info.transaction_initiation_date)
    : new Date();

  const shippingAddress = shipping.address ?? payer.address ?? null;

  return {
    provider: 'paypal',
    orderId,
    transactionId,
    amountMinor: amount.minor,
    amountMajor: amount.major,
    createdAtUtc: initiationDate.toISOString(),
    status: toNullableString(info.transaction_status),
    currency: toUpper(info.transaction_amount?.currency_code ?? null),
    customerEmail: toNullableString(payer.email_address),
    customerPhone:
      normalizePhone(payer.phone_number) ?? normalizePhone(payer.phone ?? null),
    city:
      toNullableString(shippingAddress?.city) ??
      toNullableString(shippingAddress?.admin_area_2),
    addressCountry:
      toUpper(shippingAddress?.country_code) ?? toUpper(payer.country_code),
    issueCountry: null,
    cardBrand: null,
    cardFunding: null,
    cardTokenization: null,
    cardLast4: null,
    avsLine1: null,
    avsZip: null,
    cvcStatus: null,
  };
};

const fetchPaypalTransactions = async (
  start: Date,
  end: Date,
): Promise<PaypalTransactionDetail[]> => {
  const accessToken = await getPaypalAccessToken();
  if (!accessToken) {
    return [];
  }

  const details: PaypalTransactionDetail[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = new URL(`${PAYPAL_API_BASE}/v1/reporting/transactions`);
    url.searchParams.set('start_date', start.toISOString());
    url.searchParams.set('end_date', end.toISOString());
    url.searchParams.set('page_size', '500');
    url.searchParams.set('page', String(page));
    url.searchParams.set('fields', 'transaction_info,payer_info,shipping_info');

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch PayPal transactions: ${response.status} ${text}`);
    }

    const data = await response.json();
    const pageDetails = Array.isArray(data.transaction_details)
      ? (data.transaction_details as PaypalTransactionDetail[])
      : [];

    details.push(...pageDetails);

    totalPages =
      typeof data.total_pages === 'number' && data.total_pages > 0 ? data.total_pages : 1;
    page += 1;
  }

  return details;
};

export interface PaypalCardInfoOptions {
  start: Date;
  end: Date;
}

export const fetchPaypalCardInfo = async (
  options: PaypalCardInfoOptions,
): Promise<CardInfoRecord[]> => {
  const transactions = await fetchPaypalTransactions(options.start, options.end);

  const records = transactions
    .map(mapPaypalTransactionToCardInfo)
    .filter((record): record is CardInfoRecord => record !== null);

  return records;
};

export const paypalChargeTool = createTool({
  id: 'paypal-charge-tool',
  description: 'Get PayPal Express Checkout transactions for a date range.',
  inputSchema: dateRangeSchema,
  outputSchema: z.array(cardInfoRecordSchema),
  execute: async ({ context }) => {
    try {
      const { start, end } = parseDateRange(context.startDate, context.endDate);
      return await fetchPaypalCardInfo({ start, end });
    } catch (error) {
      console.error(error);
      return [];
    }
  },
});

function parseDateRange(startDate: string, endDate: string) {
  const start = parseDate(startDate, 'startDate', true);
  const end = parseDate(endDate, 'endDate', false);

  if (end.getTime() < start.getTime()) {
    throw new Error('endDate must be after startDate');
  }

  return { start, end };
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
