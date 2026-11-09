import type { AccountSnapshotView, FillEvent, TraderSnapshotView } from 'contracts';
import type { Decimal } from 'decimal.js';
import type { TraderSnapshot } from '../application/get-trader-snapshot.js';
import type { AccountSnapshot, Fill } from '../domain/model.js';

const usd = (value: Decimal) => value.toFixed(2);
const price = (value: Decimal) => value.toDecimalPlaces(6).toString();

/** Explicit field-by-field mapping: nothing reaches the wire unless it is listed here. */
const toAccountView = (snapshot: AccountSnapshot): AccountSnapshotView => {
  const { account } = snapshot;
  return {
    accountId: account.id,
    accountNumberLast4: account.accountNumber.slice(-4),
    type: account.type,
    status: account.status,
    balanceUsd: usd(account.balanceUsd),
    positions: snapshot.positions.map((position) => ({
      symbol: position.instrument.symbol,
      description: position.instrument.description,
      netQuantity: position.netQuantity,
      averagePrice: price(position.averagePrice),
      markPrice: price(position.markPrice),
      notionalUsd: usd(position.notionalUsd),
      unrealizedPnlUsd: usd(position.unrealizedPnlUsd),
    })),
    realizedPnlUsd: usd(snapshot.realizedPnlUsd),
    commissionsUsd: usd(snapshot.commissionsUsd),
    unrealizedPnlUsd: usd(snapshot.unrealizedPnlUsd),
    dayPnlUsd: usd(snapshot.dayPnlUsd),
    notionalUsd: usd(snapshot.notionalUsd),
    riskScore: snapshot.riskScore,
    riskLevel: snapshot.riskLevel,
    fillsToday: snapshot.fillsToday,
    ordersToday: snapshot.ordersToday,
  };
};

export const toSnapshotView = (snapshot: TraderSnapshot): TraderSnapshotView => ({
  portalName: snapshot.portalName,
  traderId: snapshot.traderId,
  sessionStart: snapshot.sessionStart.toISOString(),
  asOf: snapshot.asOf.toISOString(),
  marksAsOf: snapshot.marksAsOf?.toISOString() ?? null,
  accounts: snapshot.accounts.map(toAccountView),
});

export const toFillEvent = (fill: Fill): FillEvent => ({
  fillId: fill.id,
  accountId: fill.accountId,
  symbol: fill.symbol,
  side: fill.side,
  quantity: fill.quantity,
  price: price(fill.price),
  filledAt: fill.filledAt.toISOString(),
});
