import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local development proxies to the local API on 5186. With BT_API set (as `npm run dev:online`
// does, for v0 and other hosted editors) the front end runs on its own and every /api and
// /reference request goes to that deployment instead. The proxy presents the deployment's own
// origin, so the server's same-origin check is satisfied without loosening it.
const online = process.env.BT_API?.replace(/\/$/, "");
const proxyTo = (target: string) => ({
  target,
  changeOrigin: true,
  secure: true,
  headers: online ? { origin: target } : undefined,
});

export default defineConfig({
  plugins: [react()],
  server: online
    ? {
        host: true,
        port: Number(process.env.PORT) || 3000,
        allowedHosts: true,
        proxy: { "/api": proxyTo(online), "/reference": proxyTo(online) },
      }
    : {
        host: "127.0.0.1",
        port: 5185,
        strictPort: true,
        proxy: {
          "/api": "http://127.0.0.1:5186",
          "/reference": "http://127.0.0.1:5186",
        },
      },
});
