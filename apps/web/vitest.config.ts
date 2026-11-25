import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "next/navigation": "next/navigation.js",
      "next/server": "next/server.js",
      "next/headers": "next/headers.js",
    },
  },
  test: {
    server: {
      deps: {
        inline: ["next-intl"],
      },
    },
  },
});
