import type { Principal } from '../../auth/principal.js';
import type { Account, Fill, Instrument, Mark } from '../domain/model.js';

export interface TraderBook {
  portalName: string;
  accounts: Account[];
  fills: Fill[];
}

/** Every read and write takes the authenticated trader: an adapter cannot be called without a tenant. */
export abstract class TradingRepository {
  abstract loadBook(trader: Principal, until: Date): Promise<TraderBook>;
  abstract findAccount(trader: Principal, accountId: string): Promise<Account | undefined>;
  abstract recordFill(trader: Principal, fill: Fill): Promise<void>;
}

export abstract class MarketDataRepository {
  abstract instruments(): Promise<Instrument[]>;
  abstract marks(): Promise<Mark[]>;
}

export abstract class Clock {
  abstract now(): Date;
}

export abstract class FillPublisher {
  abstract publish(trader: Principal, fill: Fill): void;
}
