import { createTool } from '@mastra/core';
import z from 'zod';

const inputSchema = z.object({
  timeZone: z.string().describe('IANA time zone, e.g. Asia/Makassar, UTC, America/New_York'),
  datetime: z
    .string()
    .describe('ISO datetime (defaults to now). Example: 2025-11-16T00:00:00Z')
    .optional(),
});

const outputSchema = z.object({
  timeZone: z.string(),
  isoInputUtc: z.string(),
  formatted: z.string(),
  offsetMinutes: z.number(),
  offsetLabel: z.string(),
  timeZoneName: z.string(),
});

export const timezoneInfoTool = createTool({
  id: 'timezone-info-tool',
  description: 'Return offset and formatted time for a given IANA time zone.',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const date = context.datetime ? new Date(context.datetime) : new Date();
    if (Number.isNaN(date.getTime())) {
      throw new Error('Invalid datetime supplied. Use ISO format, e.g. 2025-11-16T00:00:00Z');
    }

    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: context.timeZone,
      timeZoneName: 'shortOffset',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = fmt.formatToParts(date);
    const timeZoneName = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'UTC';
    const formatted = parts.map((p) => p.value).join('');

    const { offsetMinutes, offsetLabel } = parseOffset(timeZoneName);

    return {
      timeZone: context.timeZone,
      isoInputUtc: date.toISOString(),
      formatted,
      offsetMinutes,
      offsetLabel,
      timeZoneName,
    };
  },
});

function parseOffset(tzName: string): { offsetMinutes: number; offsetLabel: string } {
  const m = tzName.match(/GMT([+-]\d{2})(?::?(\d{2}))?/i);
  if (!m) {
    return { offsetMinutes: 0, offsetLabel: 'GMT±00:00' };
  }
  const hours = Number(m[1]);
  const mins = m[2] ? Number(m[2]) : 0;
  const total = hours * 60 + Math.sign(hours) * mins;
  const sign = total >= 0 ? '+' : '-';
  const absMins = Math.abs(total);
  const hh = String(Math.floor(absMins / 60)).padStart(2, '0');
  const mm = String(absMins % 60).padStart(2, '0');
  return { offsetMinutes: total, offsetLabel: `GMT${sign}${hh}:${mm}` };
}
