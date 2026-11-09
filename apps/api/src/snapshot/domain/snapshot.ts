import { Decimal } from 'decimal.js';
import type { Account, AccountSnapshot, Fill, Instrument, Mark, ValuedPosition } from './model.js';
import { replayFills } from './positions.js';
import { riskLevel, riskScore } from './risk.js';

export class MissingMarkError extends Error {
  constructor(symbol: string) {
    super(`No mark price for ${symbol}`);
  }
}

export class UnknownInstrumentError extends Error {
  constructor(symbol: string) {
    super(`Unknown instrument ${symbol}`);
  }
}

/** A closed account is noise, unless it still holds exposure: hiding that would hide risk. */
export const isReported = (snapshot: AccountSnapshot): boolean =>
  snapshot.account.status !== 'closed' || snapshot.positions.length > 0;

export const acceptsFills = (account: Account): boolean => account.status !== 'closed';

const sum = (values: readonly Decimal[]) => values.reduce((a, b) => a.plus(b), new Decimal(0));

export const buildAccountSnapshot = ({
  account,
  fills,
  instruments,
  marks,
  sessionStart,
}: {
  account: Account;
  fills: readonly Fill[];
  instruments: ReadonlyMap<string, Instrument>;
  marks: ReadonlyMap<string, Mark>;
  sessionStart: Date;
}): AccountSnapshot => {
  const instrumentOf = (symbol: string) => {
    const instrument = instruments.get(symbol);
    if (!instrument) throw new UnknownInstrumentError(symbol);
    return instrument;
  };

  const ledger = replayFills(fills, (symbol) => instrumentOf(symbol).pointValueUsd, sessionStart);

  const positions: ValuedPosition[] = [...ledger.positions]
    .map(([symbol, position]) => {
      const instrument = instrumentOf(symbol);
      const mark = marks.get(symbol);
      if (!mark) throw new MissingMarkError(symbol);
      return {
        ...position,
        instrument,
        markPrice: mark.price,
        notionalUsd: mark.price.mul(Math.abs(position.netQuantity)).mul(instrument.pointValueUsd),
        unrealizedPnlUsd: mark.price
          .minus(position.averagePrice)
          .mul(position.netQuantity)
          .mul(instrument.pointValueUsd),
      };
    })
    .toSorted((a, b) => a.instrument.symbol.localeCompare(b.instrument.symbol));

  const unrealizedPnlUsd = sum(positions.map((p) => p.unrealizedPnlUsd));
  const notionalUsd = sum(positions.map((p) => p.notionalUsd));
  const score = riskScore(notionalUsd, account.balanceUsd);

  return {
    account,
    positions,
    realizedPnlUsd: ledger.realizedPnlUsd,
    commissionsUsd: ledger.commissionsUsd,
    unrealizedPnlUsd,
    dayPnlUsd: ledger.realizedPnlUsd.minus(ledger.commissionsUsd).plus(unrealizedPnlUsd),
    notionalUsd,
    riskScore: score,
    riskLevel: riskLevel(score),
    fillsToday: ledger.fillsToday,
    ordersToday: ledger.ordersToday,
  };
};
