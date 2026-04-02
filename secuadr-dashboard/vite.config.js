import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/users": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/sessions": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/metrics": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/risk": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/stream": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
