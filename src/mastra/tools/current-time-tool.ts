import { createTool } from '@mastra/core';
import { z } from 'zod';

const currentTimeSchema = z.object({
  time: z.string().describe('Current timestamp in ISO 8601 format'),
});

export async function getCurrentIsoTime(): Promise<string> {
  return new Date().toISOString();
}

export const getCurrentTime = createTool({
  id: 'getCurrentTime',
  description: 'Get the current time',
  outputSchema: currentTimeSchema,
  execute: async () => {
    return { time: await getCurrentIsoTime() };
  },
});
