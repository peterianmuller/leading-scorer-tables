import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The React app lives in ./client and builds to ./dist, which server.js
// serves. In development, `npm run dev` serves the client with hot reload and
// forwards /api to the Node server, which runs alongside via `npm run dev:server`.
export default defineConfig({
  root: "client",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: { proxy: { "/api": `http://localhost:${process.env.PORT || 3000}` } },
});
