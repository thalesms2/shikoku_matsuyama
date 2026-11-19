import { defineConfig } from "vitest/config";

// Separado do vite.config.ts para não subir o servidor Colyseus nos testes.
// Testes de UI usam `// @vitest-environment jsdom` no topo do arquivo.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "server/**/*.ts"],
      exclude: ["**/*.d.ts"],
      reporter: ["text", "html", "lcov"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
