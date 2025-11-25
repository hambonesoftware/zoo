// vite.config.js
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: ".",                // project root (where index.html is)
  publicDir: "public",      // folder for static assets (default is 'public')
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  server: {
    open: true,            // open browser automatically
    port: 5173             // or your favorite port
  },
  build: {
    outDir: "dist",        // build output directory
    sourcemap: true
  }
});
