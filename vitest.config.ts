import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Separate from vite.config.ts, which sets `root: client` for the browser build.
 * Tests live across server/, shared/ and client/, so the test root is the repo root.
 *
 * The default environment stays `node` for the server suites. Client component
 * tests opt into jsdom per file with a `// @vitest-environment jsdom` docblock,
 * which keeps the (much faster) node environment for everything else.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    root: __dirname,
    include: ["{server,shared,client}/**/*.{test,spec}.{ts,tsx}"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "client", "src"),
    },
  },
});
