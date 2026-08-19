/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Daily Streak",
        short_name: "Daily Streak",
        description: "A minimal habit tracker.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#fffefb",
        theme_color: "#201515",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        // Same policy as the vanilla app's hand-written service worker: cache the app shell,
        // never intercept Supabase/API requests.
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/realtime\//],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
