import { Injectable } from '@nestjs/common';
import type { Principal } from '../../auth/principal.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { Database } from '../../tenancy/database.js';
import { type TraderBook, TradingRepository } from '../application/ports.js';
import type { Account, Fill } from '../domain/model.js';
import { toDecimal } from './decimal.js';

const accountColumns = {
  id: true,
  accountNumber: true,
  type: true,
  status: true,
  balance: true,
} satisfies Prisma.AccountSelect;

const toAccount = (row: Prisma.AccountGetPayload<{ select: typeof accountColumns }>): Account => ({
  id: row.id,
  accountNumber: row.accountNumber,
  type: row.type,
  status: row.status,
  balanceUsd: toDecimal(row.balance),
});

/**
 * Each query names broker and trader explicitly, and also runs inside a tenant transaction so Postgres RLS
 * rejects anything outside the caller's broker even if a filter here is ever dropped.
 */
@Injectable()
export class PrismaTradingRepository extends TradingRepository {
  constructor(private readonly database: Database) {
    super();
  }

  async loadBook(trader: Principal, until: Date): Promise<TraderBook> {
    const scope = { brokerId: trader.brokerId, traderId: trader.traderId };
    const { broker, accounts, fills } = await this.database.withTenant(trader, async (tx) => ({
      broker: await tx.broker.findUniqueOrThrow({
        where: { id: trader.brokerId },
        select: { whiteLabelName: true },
      }),
      accounts: await tx.account.findMany({
        where: scope,
        select: accountColumns,
        orderBy: { accountNumber: 'asc' },
      }),
      // Filtered through the account relation, so it needs nothing from the query above. The domain sorts for replay.
      fills: await tx.fill.findMany({
        where: { brokerId: trader.brokerId, filledAt: { lte: until }, account: scope },
        select: {
          id: true,
          accountId: true,
          instrumentSymbol: true,
          side: true,
          quantity: true,
          price: true,
          commissionUsd: true,
          filledAt: true,
          orderId: true,
        },
      }),
    }));

    return {
      portalName: broker.whiteLabelName,
      accounts: accounts.map(toAccount),
      fills: fills.map((row): Fill => ({
        id: row.id,
        accountId: row.accountId,
        symbol: row.instrumentSymbol,
        side: row.side,
        quantity: row.quantity,
        price: toDecimal(row.price),
        commissionUsd: toDecimal(row.commissionUsd),
        filledAt: row.filledAt,
        orderId: row.orderId,
      })),
    };
  }

  async findAccount(trader: Principal, accountId: string): Promise<Account | undefined> {
    const row = await this.database.withTenant(trader, (tx) =>
      tx.account.findFirst({
        where: { id: accountId, brokerId: trader.brokerId, traderId: trader.traderId },
        select: accountColumns,
      }),
    );
    return row ? toAccount(row) : undefined;
  }

  async recordFill(trader: Principal, fill: Fill): Promise<void> {
    await this.database.withTenant(trader, (tx) =>
      tx.fill.create({
        data: {
          id: fill.id,
          brokerId: trader.brokerId,
          accountId: fill.accountId,
          instrumentSymbol: fill.symbol,
          side: fill.side,
          quantity: fill.quantity,
          price: fill.price.toString(),
          commissionUsd: fill.commissionUsd.toString(),
          filledAt: fill.filledAt,
          orderId: fill.orderId,
          liquidity: 'taker',
        },
        select: { id: true },
      }),
    );
  }
}
