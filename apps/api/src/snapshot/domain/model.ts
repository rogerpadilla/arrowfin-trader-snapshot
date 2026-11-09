import type { AccountStatus, AccountType, RiskLevel, Side } from 'contracts';
import type { Decimal } from 'decimal.js';

export type { AccountStatus, AccountType, RiskLevel, Side };

export interface Fill {
  id: string;
  accountId: string;
  symbol: string;
  side: Side;
  quantity: number;
  price: Decimal;
  commissionUsd: Decimal;
  filledAt: Date;
  orderId: string;
}

export interface Instrument {
  symbol: string;
  description: string;
  pointValueUsd: Decimal;
  /** Per contract, per side. */
  commissionPerContractUsd: Decimal;
}

export interface Mark {
  symbol: string;
  price: Decimal;
  asOf: Date;
}

export interface Account {
  id: string;
  accountNumber: string;
  type: AccountType;
  status: AccountStatus;
  balanceUsd: Decimal;
}

/** Signed quantity: positive is long, negative is short. */
export interface Position {
  netQuantity: number;
  averagePrice: Decimal;
}

export interface ValuedPosition extends Position {
  instrument: Instrument;
  markPrice: Decimal;
  notionalUsd: Decimal;
  unrealizedPnlUsd: Decimal;
}

export interface AccountSnapshot {
  account: Account;
  positions: ValuedPosition[];
  realizedPnlUsd: Decimal;
  commissionsUsd: Decimal;
  unrealizedPnlUsd: Decimal;
  dayPnlUsd: Decimal;
  notionalUsd: Decimal;
  riskScore: number;
  riskLevel: RiskLevel;
  fillsToday: number;
  ordersToday: number;
}
