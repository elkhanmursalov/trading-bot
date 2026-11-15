import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Library build: one ESM file + one CSS file; React and the chart library stay external. */
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
      cssFileName: "style",
    },
    rollupOptions: {
      external: [/^react($|\/)/, /^react-dom($|\/)/, "lightweight-charts"],
      output: {
        // Next.js App Router: marks the whole package as a client component.
        banner: '"use client";',
      },
    },
  },
});
