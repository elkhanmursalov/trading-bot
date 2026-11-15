import '../../styles/bot.css';
import { describeBot } from '../../utils/botStatus';
import type { BotStatus } from '../../types/backend';
import type { AccountStreamStatus } from '../../data/useAccountStream';
import { useNow } from '../../hooks/useNow';

const REFRESH_MS = 30_000;

export interface BotBadgeProps {
  bot: BotStatus | null;
  stream: AccountStreamStatus;
}

/** Small header indicator: is the bot running, and when does it check next. */
export function BotBadge({ bot, stream }: BotBadgeProps) {
  const now = useNow(REFRESH_MS);
  const info = describeBot(bot, stream, now);
  if (!info) return null;

  return (
    <span className="btw-badge" data-tone={info.tone} title={info.tooltip}>
      <span>
        {info.label}
        {info.detail && (
          <span className="btw-badge-detail">: {info.detail}</span>
        )}
      </span>
    </span>
  );
}
