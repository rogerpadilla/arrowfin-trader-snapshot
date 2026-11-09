import { Injectable } from '@nestjs/common';
import type { Principal } from '../../auth/principal.js';
import type { AccountSnapshot, Mark } from '../domain/model.js';
import { tradingSessionStart } from '../domain/session.js';
import { buildAccountSnapshot, isReported } from '../domain/snapshot.js';
import { Clock, MarketDataRepository, TradingRepository } from './ports.js';

export interface TraderSnapshot {
  portalName: string;
  traderId: string;
  sessionStart: Date;
  asOf: Date;
  marksAsOf: Date | undefined;
  accounts: AccountSnapshot[];
}

/** The stalest mark bounds how current the valuation is. */
const oldestMark = (marks: readonly Mark[]) =>
  marks.reduce<Date | undefined>(
    (oldest, { asOf }) => (!oldest || asOf < oldest ? asOf : oldest),
    undefined,
  );

@Injectable()
export class GetTraderSnapshot {
  constructor(
    private readonly trading: TradingRepository,
    private readonly marketData: MarketDataRepository,
    private readonly clock: Clock,
  ) {}

  async execute(trader: Principal): Promise<TraderSnapshot> {
    const asOf = this.clock.now();
    const sessionStart = tradingSessionStart(asOf);
    const [book, instruments, marks] = await Promise.all([
      this.trading.loadBook(trader, asOf),
      this.marketData.instruments(),
      this.marketData.marks(),
    ]);
    const instrumentsBySymbol = new Map(instruments.map((i) => [i.symbol, i]));
    const marksBySymbol = new Map(marks.map((m) => [m.symbol, m]));
    const fillsByAccount = Map.groupBy(book.fills, (fill) => fill.accountId);

    const accounts = book.accounts
      .map((account) =>
        buildAccountSnapshot({
          account,
          fills: fillsByAccount.get(account.id) ?? [],
          instruments: instrumentsBySymbol,
          marks: marksBySymbol,
          sessionStart,
        }),
      )
      .filter(isReported);

    return {
      portalName: book.portalName,
      traderId: trader.traderId,
      sessionStart,
      asOf,
      marksAsOf: oldestMark(marks),
      accounts,
    };
  }
}
