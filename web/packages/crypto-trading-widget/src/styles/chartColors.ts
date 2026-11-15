import type { ResolvedTheme } from "../types/widget";

/** Colours used inside the chart canvas (CSS variables cannot reach it). */
export interface ChartColors {
  background: string;
  text: string;
  grid: string;
  border: string;
  crosshair: string;
  up: string;
  down: string;
  upVolume: string;
  downVolume: string;
  smaFast: string;
  smaSlow: string;
}

export const CHART_COLORS: Record<ResolvedTheme, ChartColors> = {
  light: {
    background: "#ffffff",
    text: "#4b5563",
    grid: "#f0f2f5",
    border: "#e5e7eb",
    crosshair: "#6b7280",
    up: "#16a34a",
    down: "#dc2626",
    upVolume: "rgba(22, 163, 74, 0.45)",
    downVolume: "rgba(220, 38, 38, 0.45)",
    smaFast: "#111827",
    smaSlow: "#f59e0b",
  },
  dark: {
    background: "#0f1115",
    text: "#a1a7b3",
    grid: "#1b1f27",
    border: "#262b35",
    crosshair: "#7b8494",
    up: "#22c55e",
    down: "#ef4444",
    upVolume: "rgba(34, 197, 94, 0.45)",
    downVolume: "rgba(239, 68, 68, 0.45)",
    smaFast: "#e5e7eb",
    smaSlow: "#f59e0b",
  },
};
