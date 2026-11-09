import { Decimal } from 'decimal.js';
import type { Clock, MarketDataRepository, TradingRepository } from './application/ports.js';
import type { Account, Fill, Instrument, Mark } from './domain/model.js';

export const d = (value: Decimal.Value) => new Decimal(value);

export const MES: Instrument = {
  symbol: 'MES',
  description: 'Micro E-mini S&P 500',
  pointValueUsd: d(5),
  commissionPerContractUsd: d('0.70'),
};

export const anAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'ACC-1',
  accountNumber: 'APX-100001',
  type: 'funded',
  status: 'active',
  balanceUsd: d(10000),
  ...overrides,
});

/** Each fill is its own order unless the test says otherwise. */
export const aFill = ({
  id = 'FIL-1',
  ...overrides
}: Partial<Fill> & Pick<Fill, 'side' | 'quantity' | 'price'>): Fill => ({
  id,
  accountId: 'ACC-1',
  symbol: 'MES',
  commissionUsd: d('0.70'),
  filledAt: new Date('2026-08-25T13:00:00Z'),
  orderId: `ORD-${id}`,
  ...overrides,
});

export const fixedClock = (now: Date): Clock => ({ now: () => now });

export const marketDataOf = (
  instruments: Instrument[],
  marks: Mark[] = [],
): MarketDataRepository => ({
  instruments: async () => instruments,
  marks: async () => marks,
});

export const tradingWith = (overrides: Partial<TradingRepository>): TradingRepository => ({
  loadBook: async () => ({ portalName: 'Test Portal', accounts: [], fills: [] }),
  findAccount: async () => undefined,
  recordFill: async () => undefined,
  ...overrides,
});
