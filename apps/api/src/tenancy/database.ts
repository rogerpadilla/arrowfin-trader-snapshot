import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { type Prisma, PrismaClient } from '../generated/prisma/client.js';

export interface TenantScope {
  brokerId: string;
}

export type TenantTransaction = Prisma.TransactionClient;

/** Global, non-tenant reference tables. Typed down so tenant tables cannot be reached through it. */
export type ReferencePrisma = Pick<PrismaClient, 'instrument' | 'marketPrice'>;

/** The only way into the database. There is no accessor for an unscoped client. */
@Injectable()
export class Database implements OnModuleDestroy {
  readonly #prisma: PrismaClient;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.#prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: config.databaseUrl }),
    });
  }

  /**
   * Runs one unit of work in a single transaction that first sets `app.broker_id`, the value the RLS policies read.
   * The setting is transaction-local, so a pooled connection never carries one tenant's context into the next request.
   */
  withTenant<T>(
    { brokerId }: TenantScope,
    work: (tx: TenantTransaction) => Promise<T>,
  ): Promise<T> {
    return this.#prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.broker_id', ${brokerId}, TRUE)`;
      return work(tx);
    });
  }

  get reference(): ReferencePrisma {
    return this.#prisma;
  }

  async onModuleDestroy() {
    await this.#prisma.$disconnect();
  }
}
