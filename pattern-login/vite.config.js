import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on("error", (err) => {
            console.log("🔥 Proxy error", err);
          });
          proxy.on("proxyReq", (proxyReq, req) => {
            console.log("🔥 Sending Request to API:", req.method, req.url);
          });
          proxy.on("proxyRes", (proxyRes, req) => {
            console.log(
              "🔥 Received Response from API:",
              proxyRes.statusCode,
              req.url
            );
          });
        },
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern",
        silenceDeprecations: ["legacy-js-api"],
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
