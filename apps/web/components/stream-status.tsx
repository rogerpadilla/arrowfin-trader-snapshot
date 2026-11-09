import type { FillEvent } from 'contracts';
import Link from 'next/link';
import { formatPrice, formatUtcTime } from '@/lib/format';
import type { StreamStatus } from '@/lib/use-fill-stream';
import { pageWidth } from './layout';

const BADGE: Record<StreamStatus, { label: string; dot: string }> = {
  connecting: { label: 'Connecting', dot: 'bg-muted' },
  live: { label: 'Live', dot: 'bg-up' },
  reconnecting: { label: 'Reconnecting', dot: 'bg-warn' },
  'signed-out': { label: 'Offline', dot: 'bg-down' },
};

export function StreamBadge({ status }: { status: StreamStatus }) {
  const { label, dot } = BADGE[status];
  return (
    <span className="flex items-center gap-2 text-xs font-medium">
      <span className="relative flex size-2" aria-hidden>
        {status === 'live' && (
          <span className="absolute inline-flex size-full rounded-full bg-up opacity-60 motion-safe:animate-ping" />
        )}
        <span className={`relative inline-flex size-2 rounded-full ${dot}`} />
      </span>
      {label}
    </span>
  );
}

export function LastFill({ fill }: { fill: FillEvent | undefined }) {
  if (!fill) return null;
  return (
    <span
      key={fill.fillId}
      className="figure flash-neutral hidden rounded bg-raised px-2 py-1 text-xs text-muted motion-safe:animate-flash md:inline"
      aria-live="polite"
    >
      Last fill <span className={fill.side === 'BUY' ? 'text-up' : 'text-down'}>{fill.side}</span>{' '}
      {fill.quantity} {fill.symbol} @ {formatPrice(fill.price)} · {formatUtcTime(fill.filledAt)}
    </span>
  );
}

/** Shown whenever the stream is not live, so the figures are never presented as current when they might not be. */
export function StaleNotice({ status, asOf }: { status: StreamStatus; asOf: string | undefined }) {
  if (status === 'live' || status === 'connecting') return null;
  if (status === 'signed-out') {
    return (
      <output className="block bg-down/15 text-sm text-down">
        <span className={`${pageWidth} block py-2`}>
          Your session has ended and live updates have stopped.{' '}
          <Link href="/login" className="underline underline-offset-2">
            Sign in again
          </Link>
        </span>
      </output>
    );
  }
  return (
    <output className="block bg-warn/15 text-sm text-warn">
      <span className={`${pageWidth} block py-2`}>
        Live feed disconnected. Figures below were last confirmed
        {asOf ? ` at ${formatUtcTime(asOf)}` : ''} and may be stale. Reconnecting…
      </span>
    </output>
  );
}
