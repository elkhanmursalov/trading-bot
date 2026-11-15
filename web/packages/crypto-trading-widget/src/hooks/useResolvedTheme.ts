import { useEffect, useState } from "react";

import type { ResolvedTheme, Theme } from "../types/widget";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Turns the `theme` prop into "light" or "dark".
 * For "auto" it follows the computer's setting and updates when that setting changes.
 * Starts as "light" and checks the setting after mount, so server rendering (Next.js) matches.
 */
export function useResolvedTheme(theme: Theme): ResolvedTheme {
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    if (theme !== "auto") return;
    const query = window.matchMedia(DARK_QUERY);
    const update = () => setSystemTheme(query.matches ? "dark" : "light");
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [theme]);

  return theme === "auto" ? systemTheme : theme;
}
