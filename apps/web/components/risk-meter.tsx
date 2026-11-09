import {
  RISK_ALERT_THRESHOLD,
  RISK_WARN_THRESHOLD,
  type AccountSnapshotView,
  type RiskLevel,
} from 'contracts';
import { LiveValue } from './live-value';

const LEVEL: Record<RiskLevel, { label: string; bar: string; text: string }> = {
  high: { label: 'High', bar: 'bg-alarm', text: 'text-alarm' },
  elevated: { label: 'Elevated', bar: 'bg-warn', text: 'text-warn' },
  normal: { label: 'Normal', bar: 'bg-up', text: 'text-up' },
};

/** Always names the level in words, so the reading never depends on colour alone. */
export function RiskMeter({
  account: { riskScore, riskLevel },
  labelId,
}: {
  account: Pick<AccountSnapshotView, 'riskScore' | 'riskLevel'>;
  labelId: string;
}) {
  const { label, bar, text } = LEVEL[riskLevel];
  return (
    <div className="flex items-center gap-4">
      <span id={labelId} className="caption w-10 shrink-0">
        Risk
      </span>
      <span className={`figure w-14 shrink-0 text-right text-lg font-semibold ${text}`}>
        <LiveValue value={riskScore} meaning="up-is-bad">
          {riskScore.toFixed(1)}
        </LiveValue>
      </span>
      <meter
        className="sr-only"
        aria-labelledby={labelId}
        min={0}
        max={100}
        low={RISK_WARN_THRESHOLD}
        high={RISK_ALERT_THRESHOLD}
        optimum={0}
        value={riskScore}
      >
        {riskScore.toFixed(1)} of 100, {label}
      </meter>
      <div className="relative h-1.5 flex-1 rounded-full bg-raised" aria-hidden>
        <div
          className={`h-full rounded-full ${bar} motion-safe:transition-[width] motion-safe:duration-500`}
          style={{ width: `${riskScore}%` }}
        />
        <div
          className="absolute -top-1 -bottom-1 w-px bg-ink/40"
          style={{ left: `${RISK_ALERT_THRESHOLD}%` }}
          title={`Alert above ${RISK_ALERT_THRESHOLD}`}
        />
      </div>
      <span className={`w-16 shrink-0 text-xs font-medium ${text}`} aria-hidden>
        {label}
      </span>
    </div>
  );
}
