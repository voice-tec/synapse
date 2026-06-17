import { defineConfig } from 'vitest/config';
import path from 'path';

// Alias '@' come in tsconfig, così i moduli lib/* risolvono gli import '@/lib/...'.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: { environment: 'node', include: ['lib/**/*.test.ts'] },
});
