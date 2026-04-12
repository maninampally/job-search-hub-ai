import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: [
      "server/tests/**/*.test.{js,mjs}",
      "client/src/**/*.test.{js,jsx,ts,tsx}",
    ],
    setupFiles: ["client/src/__tests__/setup.js"],
    coverage: {
      provider: "v8",
      include: [
        "server/src/**/*.js",
        "client/src/**/*.{js,jsx,ts,tsx}",
      ],
      exclude: [
        "server/src/config/**",
        "client/src/main.jsx",
        "client/src/App.jsx",
        "**/*.module.css",
      ],
    },
  },
});
