import { Injectable } from '@nestjs/common';
import { Database } from '../../tenancy/database.js';
import { MarketDataRepository } from '../application/ports.js';
import type { Instrument, Mark } from '../domain/model.js';
import { toDecimal } from './decimal.js';

@Injectable()
export class PrismaMarketDataRepository extends MarketDataRepository {
  constructor(private readonly database: Database) {
    super();
  }

  async instruments(): Promise<Instrument[]> {
    const rows = await this.database.reference.instrument.findMany({
      select: {
        symbol: true,
        description: true,
        pointValueUsd: true,
        commissionPerContractUsd: true,
      },
    });
    return rows.map((row) => ({
      symbol: row.symbol,
      description: row.description,
      pointValueUsd: toDecimal(row.pointValueUsd),
      commissionPerContractUsd: toDecimal(row.commissionPerContractUsd),
    }));
  }

  async marks(): Promise<Mark[]> {
    const rows = await this.database.reference.marketPrice.findMany({
      select: { symbol: true, markPrice: true, asOf: true },
    });
    return rows.map((row) => ({
      symbol: row.symbol,
      price: toDecimal(row.markPrice),
      asOf: row.asOf,
    }));
  }
}
