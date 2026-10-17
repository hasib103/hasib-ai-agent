// @lovable.dev/vite-tanstack-config already includes the app plugins and aliases.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Build a portable Node.js server for Render instead of the default Cloudflare target.
  nitro: { preset: "node-server" },
  tanstackStart: {
    server: { entry: "server" },
  },
});
