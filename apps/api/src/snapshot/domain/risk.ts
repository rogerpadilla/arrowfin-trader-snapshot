import { RISK_ALERT_THRESHOLD, RISK_WARN_THRESHOLD } from 'contracts';
import type { Decimal } from 'decimal.js';
import type { RiskLevel } from './model.js';

const MAX_RISK = 100;

/** `min(100, |notional| / balance * 100)`, rounded to one decimal. Exposure without a positive balance is maximum risk. */
export const riskScore = (notionalUsd: Decimal, balanceUsd: Decimal): number => {
  const exposure = notionalUsd.abs();
  if (exposure.isZero()) return 0;
  if (balanceUsd.lte(0)) return MAX_RISK;
  return Math.min(MAX_RISK, exposure.div(balanceUsd).mul(100).toDecimalPlaces(1).toNumber());
};

export const riskLevel = (score: number): RiskLevel => {
  if (score > RISK_ALERT_THRESHOLD) return 'high';
  if (score > RISK_WARN_THRESHOLD) return 'elevated';
  return 'normal';
};
