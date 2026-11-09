import { type AccountSnapshotView, RISK_ALERT_THRESHOLD } from 'contracts';
import { formatUsd, maskedAccount } from '@/lib/format';
import { accountAnchor } from './account-section';
import { pageWidth } from './layout';

/** Not colour alone: a pulsing full-width band, explicit text, and an assertive live region for screen readers. */
export function RiskAlert({ accounts }: { accounts: AccountSnapshotView[] }) {
  const atRisk = accounts.filter((account) => account.riskLevel === 'high');
  if (atRisk.length === 0) return null;
  return (
    <div role="alert" className="bg-alarm text-white motion-safe:animate-alarm">
      <div className={`${pageWidth} flex flex-wrap items-baseline gap-x-6 gap-y-1 py-2.5`}>
        <p className="text-sm font-semibold">
          High risk: exposure above {RISK_ALERT_THRESHOLD}% of balance
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {atRisk.map((account) => (
            <li key={account.accountId}>
              <a
                href={`#${accountAnchor(account.accountId)}`}
                className="underline decoration-white/40 underline-offset-4 hover:decoration-white"
              >
                Account <span className="figure">{maskedAccount(account.accountNumberLast4)}</span>{' '}
                at <span className="figure font-semibold">{account.riskScore.toFixed(1)}</span>
                <span className="text-white/75">
                  {' '}
                  ({formatUsd(account.notionalUsd)} on {formatUsd(account.balanceUsd)})
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
