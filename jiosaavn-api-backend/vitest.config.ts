import { configDefaults, defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '#modules': fileURLToPath(new URL('./src/modules', import.meta.url)),
      '#common': fileURLToPath(new URL('./src/common', import.meta.url))
    }
  },
  test: {
    include: ['src/**/*.spec.ts'],
    exclude: [...configDefaults.exclude],
    testTimeout: 30000,
    retry: 3,
    coverage: {
      enabled: false, // TODO: enable coverage once all tests are passing
      include: ['src/common', 'src/modules'],
      exclude: ['src/common/types/**'],
      provider: 'v8',
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  }
})
