import type { BotStatus } from "../types/backend";
import { formatClockUtc } from "./format";
import type { AccountStreamStatus } from "../data/useAccountStream";

/** How long after `next_check` the bot may be late before it counts as not responding. */
export const BOT_GRACE_MS = 2 * 60 * 1000;

export type BadgeTone = "ok" | "warn" | "error" | "muted";

export interface BotBadgeInfo {
  label: string;
  tone: BadgeTone;
  /** Short extra text next to the label, e.g. "next check 15:00 UTC". */
  detail?: string;
  /** Longer text shown on hover. */
  tooltip?: string;
}

/** Wording and colour of the bot badge, or null while there is nothing to show yet. */
export function describeBot(bot: BotStatus | null, stream: AccountStreamStatus, now: number): BotBadgeInfo | null {
  if (stream === "disabled") return null;
  if (stream === "reconnecting") {
    return { label: "Backend offline", tone: "warn", tooltip: "Reconnecting to the backend..." };
  }
  if (!bot) return null;

  const nextCheck = bot.next_check ? `next check ${formatClockUtc(bot.next_check / 1000)} UTC` : undefined;
  const tooltip = [bot.last_message, nextCheck].filter(Boolean).join("\n") || undefined;

  if (bot.mode === "off") {
    return { label: "Bot off", tone: "muted", tooltip: "The backend runs without a bot (BOT_MODE=off)." };
  }
  if (bot.last_error) {
    return { label: "Bot error", tone: "error", detail: nextCheck, tooltip: bot.last_error };
  }
  if (bot.next_check && now > bot.next_check + BOT_GRACE_MS) {
    return { label: "Bot not responding", tone: "error", tooltip: `Expected a check at ${nextCheck?.slice(11)}.` };
  }
  if (bot.last_check === null) {
    return { label: "Bot starting", tone: "muted" };
  }
  return {
    label: bot.mode === "dry_run" ? "Bot dry run" : "Bot running",
    tone: "ok",
    detail: nextCheck,
    tooltip,
  };
}
