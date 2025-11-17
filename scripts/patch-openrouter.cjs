const fs = require('node:fs');
const path = require('node:path');

const targetPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@openrouter',
  'ai-sdk-provider',
  'dist',
  'index.mjs',
);

const imageSchemaLine =
  'var ImageResponseArraySchema = z6.array(ImageResponseWithUnknownSchema).transform((d) => d.filter((d2) => !!d2));';
const logprobsBlock = `        logprobs: z7.object({\n          content: z7.array(\n            z7.object({\n              token: z7.string(),\n              logprob: z7.number(),\n              top_logprobs: z7.array(\n                z7.object({\n                  token: z7.string(),\n                  logprob: z7.number()\n                })\n              )\n            })\n          ).nullable()\n        }).nullable().optional(),`;
const streamLogprobsBlock = `        logprobs: z7.object({\n          content: z7.array(\n            z7.object({\n              token: z7.string(),\n              logprob: z7.number(),\n              top_logprobs: z7.array(\n                z7.object({\n                  token: z7.string(),\n                  logprob: z7.number()\n                })\n              )\n            })\n          ).nullable()\n        }).nullish(),`;
const injectedSchema = `var ImageResponseArraySchema = z6.array(ImageResponseWithUnknownSchema).transform((d) => d.filter((d2) => !!d2));\nconst OpenRouterLogprobsContentBlock = z7.object({\n  content: z7.array(\n    z7.object({\n      token: z7.string(),\n      logprob: z7.number(),\n      top_logprobs: z7.array(\n        z7.object({\n          token: z7.string(),\n          logprob: z7.number()\n        })\n      )\n    })\n  ).nullable()\n});\nconst OpenRouterLegacyLogprobsBlock = z7.object({\n  tokens: z7.array(z7.string()).nullable(),\n  token_logprobs: z7.array(z7.number()).nullable(),\n  top_logprobs: z7.array(z7.record(z7.string(), z7.number())).nullable(),\n  text_offset: z7.array(z7.number()).nullable()\n});\nconst OpenRouterLogprobsSchema = z7\n  .union([OpenRouterLogprobsContentBlock, OpenRouterLegacyLogprobsBlock])\n  .nullable()\n  .optional();`;

if (!fs.existsSync(targetPath)) {
  console.warn('[patch-openrouter] target file not found, skipping');
  process.exit(0);
}

const content = fs.readFileSync(targetPath, 'utf8');

if (content.includes('OpenRouterLogprobsSchema')) {
  console.log('[patch-openrouter] schema already patched');
  process.exit(0);
}

if (!content.includes(imageSchemaLine)) {
  console.error('[patch-openrouter] cannot find ImageResponseArraySchema line');
  process.exit(1);
}

let updated = content.replace(imageSchemaLine, injectedSchema);

if (updated === content) {
  console.error('[patch-openrouter] failed to inject logprobs helpers');
  process.exit(1);
}

updated = updated.replace(logprobsBlock, '        logprobs: OpenRouterLogprobsSchema,');

if (!updated.includes('OpenRouterLogprobsSchema')) {
  console.error('[patch-openrouter] failed to reference schema in non-stream response');
  process.exit(1);
}

if (!content.includes(streamLogprobsBlock)) {
  console.error('[patch-openrouter] cannot locate stream logprobs block');
  process.exit(1);
}

updated = updated.replace(streamLogprobsBlock, '        logprobs: OpenRouterLogprobsSchema,');

fs.writeFileSync(targetPath, updated, 'utf8');
console.log('[patch-openrouter] applied logprobs schema compatibility fix');
