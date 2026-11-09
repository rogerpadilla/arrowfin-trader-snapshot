import { Decimal } from 'decimal.js';
import type { Fill, Position, Side } from './model.js';

export const FLAT: Position = Object.freeze({ netQuantity: 0, averagePrice: new Decimal(0) });

/** Average-cost accounting for one fill against one position. Realized P&L is in USD (price points times the contract's point value). */
export const applyFill = (
  position: Position,
  side: Side,
  quantity: number,
  price: Decimal,
  pointValueUsd: Decimal,
): { position: Position; realizedPnlUsd: Decimal } => {
  const held = position.netQuantity;
  const signedQuantity = side === 'BUY' ? quantity : -quantity;
  const netQuantity = held + signedQuantity;

  if (held === 0 || Math.sign(held) === Math.sign(signedQuantity)) {
    const averagePrice = position.averagePrice
      .mul(Math.abs(held))
      .plus(price.mul(quantity))
      .div(Math.abs(netQuantity));
    return { position: { netQuantity, averagePrice }, realizedPnlUsd: new Decimal(0) };
  }

  const closedQuantity = Math.min(quantity, Math.abs(held));
  const realizedPnlUsd = price
    .minus(position.averagePrice)
    .mul(closedQuantity * Math.sign(held))
    .mul(pointValueUsd);

  if (netQuantity === 0) return { position: FLAT, realizedPnlUsd };
  const flipped = Math.sign(netQuantity) !== Math.sign(held);
  return {
    position: { netQuantity, averagePrice: flipped ? price : position.averagePrice },
    realizedPnlUsd,
  };
};

export interface Ledger {
  /** Open positions only, keyed by symbol. */
  positions: ReadonlyMap<string, Position>;
  /** Gross realized P&L of fills in the current session. */
  realizedPnlUsd: Decimal;
  commissionsUsd: Decimal;
  fillsToday: number;
  ordersToday: number;
}

const byTime = (a: Fill, b: Fill) =>
  a.filledAt.getTime() - b.filledAt.getTime() || a.id.localeCompare(b.id);

/**
 * Replays an account's full fill history: positions carry over between sessions, while realized P&L,
 * commissions and counts only include fills at or after `sessionStart`.
 */
export const replayFills = (
  fills: readonly Fill[],
  pointValueOf: (symbol: string) => Decimal,
  sessionStart: Date,
): Ledger => {
  const positions = new Map<string, Position>();
  const ordersToday = new Set<string>();
  let realizedPnlUsd = new Decimal(0);
  let commissionsUsd = new Decimal(0);
  let fillsToday = 0;

  for (const fill of fills.toSorted(byTime)) {
    const result = applyFill(
      positions.get(fill.symbol) ?? FLAT,
      fill.side,
      fill.quantity,
      fill.price,
      pointValueOf(fill.symbol),
    );
    if (result.position.netQuantity === 0) positions.delete(fill.symbol);
    else positions.set(fill.symbol, result.position);

    if (fill.filledAt >= sessionStart) {
      realizedPnlUsd = realizedPnlUsd.plus(result.realizedPnlUsd);
      commissionsUsd = commissionsUsd.plus(fill.commissionUsd);
      fillsToday += 1;
      ordersToday.add(fill.orderId);
    }
  }

  return { positions, realizedPnlUsd, commissionsUsd, fillsToday, ordersToday: ordersToday.size };
};
