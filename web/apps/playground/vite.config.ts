import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const widgetSrc = fileURLToPath(new URL("../../packages/crypto-trading-widget/src", import.meta.url));

/** Dev app: imports the widget from source, so edits show up instantly without a build. */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@elkhanmursalov\/crypto-trading-widget\/style\.css$/, replacement: `${widgetSrc}/styles.css` },
      { find: /^@elkhanmursalov\/crypto-trading-widget$/, replacement: `${widgetSrc}/index.ts` },
    ],
  },
});
