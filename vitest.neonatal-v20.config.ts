import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config";

// Focused v20 batch acceptance command. These tests also run in the default suite.
// It covers batch outputs, not complete browser/PDF/print acceptance.
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: [
      "src/lib/neonatal-calculator/__tests__/notebook-v20-reference.test.ts",
      "tests/neonatal-v20-acceptance.test.ts",
      "src/lib/neonatal-calculator/__tests__/additional-input-cases-v20.test.ts",
    ],
  },
});
