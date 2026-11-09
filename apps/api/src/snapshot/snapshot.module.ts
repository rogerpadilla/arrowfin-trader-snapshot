import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { GetTraderSnapshot } from './application/get-trader-snapshot.js';
import {
  Clock,
  FillPublisher,
  MarketDataRepository,
  TradingRepository,
} from './application/ports.js';
import { RecordFill } from './application/record-fill.js';
import { anchoredClock, systemClock } from './infrastructure/clock.js';
import { FillsGateway } from './infrastructure/fills.gateway.js';
import { PrismaMarketDataRepository } from './infrastructure/prisma-market-data.repository.js';
import { PrismaTradingRepository } from './infrastructure/prisma-trading.repository.js';
import { SnapshotController } from './infrastructure/snapshot.controller.js';

@Module({
  controllers: [SnapshotController],
  providers: [
    GetTraderSnapshot,
    RecordFill,
    FillsGateway,
    { provide: FillPublisher, useExisting: FillsGateway },
    { provide: TradingRepository, useClass: PrismaTradingRepository },
    { provide: MarketDataRepository, useClass: PrismaMarketDataRepository },
    {
      provide: Clock,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        config.clockAnchor ? anchoredClock(config.clockAnchor) : systemClock(),
    },
  ],
  exports: [RecordFill],
})
export class SnapshotModule {}
