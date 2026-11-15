import { useEffect, useState } from "react";

import type { AccountSnapshot, BotStatus } from "../types/backend";

/** "disabled" means no backend URL was given. */
export type AccountStreamStatus = "disabled" | "connecting" | "live" | "reconnecting";

export interface AccountStream {
  account: AccountSnapshot | null;
  bot: BotStatus | null;
  status: AccountStreamStatus;
}

const STREAM_PATH = "/api/stream";
const MAX_RETRY_DELAY_MS = 30_000;

/**
 * One live connection to the backend (Server-Sent Events).
 * The backend sends `account` and `bot` messages on connect and whenever they change.
 * Reconnects with growing delays (1s, 2s, 4s ... 30s); every reconnect starts with a fresh snapshot.
 */
export function useAccountStream(apiBaseUrl: string | undefined): AccountStream {
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [status, setStatus] = useState<AccountStreamStatus>(apiBaseUrl ? "connecting" : "disabled");

  useEffect(() => {
    if (!apiBaseUrl) {
      setStatus("disabled");
      return;
    }

    const url = new URL(STREAM_PATH, apiBaseUrl).toString();
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let attempts = 0;
    let hasConnected = false;

    const connect = () => {
      setStatus(hasConnected ? "reconnecting" : "connecting");
      source = new EventSource(url);

      source.addEventListener("account", (event) =>
        setAccount(JSON.parse((event as MessageEvent<string>).data) as AccountSnapshot),
      );
      source.addEventListener("bot", (event) =>
        setBot(JSON.parse((event as MessageEvent<string>).data) as BotStatus),
      );
      source.onopen = () => {
        attempts = 0;
        hasConnected = true;
        setStatus("live");
      };
      source.onerror = () => {
        source?.close(); // EventSource gives up on some errors, so reconnecting is handled here
        if (stopped) return;
        setStatus("reconnecting");
        const delay = Math.min(1000 * 2 ** attempts, MAX_RETRY_DELAY_MS);
        attempts += 1;
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      source?.close();
    };
  }, [apiBaseUrl]);

  return { account, bot, status };
}
