'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { logout } from '@/lib/api';
import { formatSessionOpen, formatUtcTime, monogram } from '@/lib/format';
import { useFillStream } from '@/lib/use-fill-stream';
import { useSnapshot } from '@/lib/use-snapshot';
import { AccountSection } from './account-section';
import { FillSimulator } from './fill-simulator';
import { quietButtonClass } from './form';
import { pageWidth } from './layout';
import { RiskAlert } from './risk-alert';
import { LastFill, StaleNotice, StreamBadge } from './stream-status';

const devTools = process.env.NEXT_PUBLIC_DEV_TOOLS === 'true';

function LoadingState() {
  return (
    <div aria-busy="true" aria-label="Loading snapshot" className="space-y-4">
      {[0, 1].map((row) => (
        <div key={row} className="h-64 animate-pulse rounded-lg border border-rule bg-panel" />
      ))}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-rule bg-panel p-6">
      <p className="text-down">Could not load your snapshot.</p>
      <button type="button" onClick={onRetry} className={`mt-3 ${quietButtonClass}`}>
        Retry
      </button>
    </div>
  );
}

export function SnapshotScreen() {
  const router = useRouter();
  const snapshot = useSnapshot();
  const stream = useFillStream();
  const data = snapshot.data;
  const [firstAccount, ...otherAccounts] = data?.accounts ?? [];
  const trusted = stream.status === 'live' && !snapshot.isError;
  const portalName = data?.portalName;

  useEffect(() => {
    if (portalName) document.title = `${portalName} · Daily Snapshot`;
  }, [portalName]);

  const signOut = async () => {
    await logout().catch(() => undefined);
    router.replace('/login');
  };

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-rule bg-panel/95 backdrop-blur">
        <div className={`${pageWidth} flex h-16 flex-wrap items-center gap-x-6 gap-y-2`}>
          <div className="flex items-center gap-3">
            {portalName && (
              <span
                aria-hidden
                className="grid size-9 place-items-center rounded-md bg-raised text-sm font-semibold tracking-wide"
              >
                {monogram(portalName)}
              </span>
            )}
            <div>
              <div className="text-sm font-semibold">{portalName ?? 'Daily Snapshot'}</div>
              <div className="text-xs text-muted">
                {data
                  ? `Trader ${data.traderId} · session opened ${formatSessionOpen(data.sessionStart)}`
                  : ' '}
              </div>
            </div>
          </div>
          <LastFill fill={stream.lastFill} />
          <div className="ml-auto flex items-center gap-5">
            {data && (
              <span className="figure hidden text-xs text-muted sm:inline">
                As of {formatUtcTime(data.asOf)}
              </span>
            )}
            <StreamBadge status={stream.status} />
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-xs text-muted hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {data && <RiskAlert accounts={data.accounts} />}
      <StaleNotice status={stream.status} asOf={data?.asOf} />

      <main
        className={`${pageWidth} flex flex-1 flex-col gap-4 py-6 transition-opacity ${data && !trusted ? 'opacity-55' : ''}`}
      >
        {snapshot.isPending && <LoadingState />}
        {snapshot.isError && !data && <ErrorState onRetry={() => void snapshot.refetch()} />}
        {data && data.accounts.length === 0 && (
          <p className="rounded-lg border border-rule bg-panel p-6 text-muted">
            There are no trading accounts on this login.
          </p>
        )}
        {data?.accounts.map((account) => (
          <AccountSection key={account.accountId} account={account} />
        ))}
        {data?.marksAsOf && (
          <p className="text-xs text-faint">
            Unrealized P&amp;L and risk use marks as of {formatUtcTime(data.marksAsOf)}. Day P&amp;L
            is realized today minus today&apos;s commissions plus unrealized on open positions.
          </p>
        )}
      </main>

      {devTools && firstAccount && <FillSimulator accounts={[firstAccount, ...otherAccounts]} />}
    </div>
  );
}
