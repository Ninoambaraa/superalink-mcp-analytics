import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { config } from '../../config';

const openrouter = createOpenRouter({
  apiKey: config.ai_models.openrouter.api_key,
});

type ModelTarget = keyof typeof config.ai_models.openrouter.models;

export const resolveOpenRouterModelId = (target: ModelTarget = 'default') =>
  config.ai_models.openrouter.models[target] ?? config.ai_models.openrouter.models.default;

export const getOpenRouterModel = (target: ModelTarget = 'default') =>
  openrouter(resolveOpenRouterModelId(target));
