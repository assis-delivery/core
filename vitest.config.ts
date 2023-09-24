import { vitestConfig } from '@assis-delivery/config';
import { InlineConfig } from 'vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default defineConfig(async (env) =>
  mergeConfig(await vitestConfig(env), {
    test: {
      setupFiles: ['vitest.setup.ts'],
    } satisfies InlineConfig,
  }),
);
