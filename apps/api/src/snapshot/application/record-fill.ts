import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import type { Principal } from '../../auth/principal.js';
import type { Fill, Side } from '../domain/model.js';
import { acceptsFills, UnknownInstrumentError } from '../domain/snapshot.js';
import { Clock, FillPublisher, MarketDataRepository, TradingRepository } from './ports.js';

export class AccountNotFoundError extends Error {
  constructor() {
    super('Account not found');
  }
}

export interface NewFill {
  accountId: string;
  symbol: string;
  side: Side;
  quantity: number;
  price: string;
}

/** Stands in for the exchange's fill feed: persists a fill for one of the caller's own accounts, then pushes it live. */
@Injectable()
export class RecordFill {
  constructor(
    private readonly trading: TradingRepository,
    private readonly marketData: MarketDataRepository,
    private readonly publisher: FillPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(trader: Principal, input: NewFill): Promise<Fill> {
    const [account, instruments] = await Promise.all([
      this.trading.findAccount(trader, input.accountId),
      this.marketData.instruments(),
    ]);
    if (!account || !acceptsFills(account)) throw new AccountNotFoundError();
    const instrument = instruments.find((i) => i.symbol === input.symbol);
    if (!instrument) throw new UnknownInstrumentError(input.symbol);

    const fill: Fill = {
      id: `FIL-${randomUUID()}`,
      accountId: account.id,
      symbol: instrument.symbol,
      side: input.side,
      quantity: input.quantity,
      price: new Decimal(input.price),
      commissionUsd: instrument.commissionPerContractUsd.mul(input.quantity),
      filledAt: this.clock.now(),
      orderId: `ORD-${randomUUID()}`,
    };
    await this.trading.recordFill(trader, fill);
    this.publisher.publish(trader, fill);
    return fill;
  }
}
