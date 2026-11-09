import type { AccountSnapshotView, DecimalString } from 'contracts';
import { formatSignedUsd, formatUsd, maskedAccount, pnlTone } from '@/lib/format';
import { pillClass } from './form';
import { type ChangeMeaning, LiveValue } from './live-value';
import { PositionsTable } from './positions-table';
import { RiskMeter } from './risk-meter';

const ACCOUNT_TYPE_LABEL: Record<AccountSnapshotView['type'], string> = {
  funded: 'Funded',
  eval: 'Evaluation',
  demo: 'Demo',
  pro: 'Pro',
  pro_plus: 'Pro+',
};

export const accountAnchor = (accountId: string) => `account-${accountId}`;

function Figure({
  label,
  amount,
  signed = false,
  meaning = 'neutral',
}: {
  label: string;
  amount: DecimalString;
  signed?: boolean;
  meaning?: ChangeMeaning;
}) {
  return (
    <div>
      <dt className="caption">{label}</dt>
      <dd className={`figure mt-1 text-base ${signed ? pnlTone(amount) : ''}`}>
        <LiveValue value={Number(amount)} meaning={meaning}>
          {signed ? formatSignedUsd(amount) : formatUsd(amount)}
        </LiveValue>
      </dd>
    </div>
  );
}

export function AccountSection({ account }: { account: AccountSnapshotView }) {
  const anchor = accountAnchor(account.accountId);
  const highRisk = account.riskLevel === 'high';
  return (
    <section
      id={anchor}
      aria-labelledby={`${anchor}-title`}
      className={`scroll-mt-24 overflow-hidden rounded-lg border ${highRisk ? 'border-alarm/60 bg-alarm-deep/60' : 'border-rule bg-panel'}`}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 pt-5 sm:px-6">
        <h2 id={`${anchor}-title`} className="text-base font-semibold">
          Account <span className="figure">{maskedAccount(account.accountNumberLast4)}</span>
        </h2>
        <span className={`${pillClass} bg-raised text-muted`}>
          {ACCOUNT_TYPE_LABEL[account.type]}
        </span>
        {account.status !== 'active' && (
          <span className={`${pillClass} bg-warn/15 text-warn`}>{account.status}</span>
        )}
        {highRisk && <span className={`${pillClass} bg-alarm text-white`}>High risk</span>}
        <span className="ml-auto text-sm text-muted">
          Balance{' '}
          <span className="figure text-ink">
            <LiveValue value={Number(account.balanceUsd)}>
              {formatUsd(account.balanceUsd)}
            </LiveValue>
          </span>
        </span>
      </header>

      <dl className="grid grid-cols-2 items-end gap-x-6 gap-y-5 px-5 pt-5 sm:grid-cols-3 sm:px-6 lg:grid-cols-6">
        <div className="col-span-2 sm:col-span-3 lg:col-span-1">
          <dt className="caption">Day P&amp;L</dt>
          <dd className={`figure mt-1 text-2xl font-semibold ${pnlTone(account.dayPnlUsd)}`}>
            <LiveValue value={Number(account.dayPnlUsd)} meaning="up-is-good">
              {formatSignedUsd(account.dayPnlUsd)}
            </LiveValue>
          </dd>
        </div>
        <Figure label="Realized" amount={account.realizedPnlUsd} signed meaning="up-is-good" />
        <Figure label="Unrealized" amount={account.unrealizedPnlUsd} signed meaning="up-is-good" />
        <Figure label="Commissions" amount={account.commissionsUsd} meaning="up-is-bad" />
        <Figure label="Notional" amount={account.notionalUsd} />
        <div>
          <dt className="caption">Fills / orders</dt>
          <dd className="figure mt-1 text-base">
            <LiveValue value={account.fillsToday}>
              {account.fillsToday} / {account.ordersToday}
            </LiveValue>
          </dd>
        </div>
      </dl>

      <div className="px-5 py-5 sm:px-6">
        <RiskMeter account={account} labelId={`${anchor}-risk`} />
      </div>

      <div className="border-t border-rule bg-canvas/30">
        <PositionsTable positions={account.positions} />
      </div>
    </section>
  );
}
