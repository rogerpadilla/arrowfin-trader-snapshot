import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { parse } from 'csv-parse/sync';
import { loadDotEnv } from '../src/config/dotenv.js';
import {
  AccountStatus,
  AccountType,
  BrokerType,
  KycStatus,
  Liquidity,
  PrismaClient,
  Side,
} from '../src/generated/prisma/client.js';

type Row = Record<string, string>;

const datasetDir = resolve(import.meta.dirname, '../../../dataset');

const readCsv = (file: string): Row[] =>
  parse(readFileSync(resolve(datasetDir, file)), { columns: true, skip_empty_lines: true });

const oneOf = <T extends string>(values: Record<string, T>, raw: string): T => {
  const match = Object.values(values).find((value) => value === raw);
  if (!match) throw new Error(`Unexpected value "${raw}"`);
  return match;
};

const required = <T>(value: T | undefined, what: string): T => {
  if (value === undefined) throw new Error(`Missing ${what}`);
  return value;
};

/** The dataset has no fee column: these are the per-contract rates its fills were charged (CL, never traded, priced like the other full-size contracts). */
const COMMISSION_PER_CONTRACT_USD: Readonly<Record<string, string>> = {
  ES: '2.10',
  MES: '0.70',
  NQ: '2.10',
  MNQ: '0.70',
  CL: '2.10',
  MCL: '0.70',
  GC: '2.10',
  '6E': '2.48',
};

// Runs as the schema owner (bypasses RLS). The traders' free-text `notes` and `audit_notes` columns are never read.
const seed = async (prisma: PrismaClient) => {
  const brokers = readCsv('brokers.csv');
  const traders = readCsv('traders.csv');
  const accounts = readCsv('accounts.csv');
  const instruments = readCsv('instruments.csv');
  const marks = readCsv('market_prices.csv');
  const fills = readCsv('fills.csv');

  const brokerOfTrader = new Map(traders.map((t) => [t.id, t.broker_id]));
  const brokerOfAccount = new Map(
    accounts.map((a) => [a.id, required(brokerOfTrader.get(a.trader_id), `trader ${a.trader_id}`)]),
  );

  await prisma.$transaction([
    prisma.$executeRaw`TRUNCATE fills, accounts, traders, market_prices, instruments, brokers`,
    prisma.broker.createMany({
      data: brokers.map((b) => ({
        id: b.id,
        name: b.name,
        type: oneOf(BrokerType, b.type),
        whiteLabelName: b.white_label_name,
        createdAt: new Date(b.created_at),
      })),
    }),
    prisma.trader.createMany({
      data: traders.map((t) => ({
        id: t.id,
        brokerId: t.broker_id,
        firstName: t.first_name,
        lastName: t.last_name,
        email: t.email,
        phone: t.phone,
        dateOfBirth: new Date(t.dob),
        ssnLast4: t.ssn_last4,
        addressLine1: t.address_line1,
        city: t.city,
        state: t.state,
        postalCode: t.postal_code,
        kycStatus: oneOf(KycStatus, t.kyc_status),
        createdAt: new Date(t.created_at),
      })),
    }),
    prisma.account.createMany({
      data: accounts.map((a) => ({
        id: a.id,
        brokerId: required(brokerOfAccount.get(a.id), `account ${a.id}`),
        traderId: a.trader_id,
        accountNumber: a.account_number,
        type: oneOf(AccountType, a.account_type),
        status: oneOf(AccountStatus, a.status),
        balance: a.balance,
        buyingPower: a.buying_power,
        maxPositionSize: Number(a.max_position_size),
        createdAt: new Date(a.created_at),
      })),
    }),
    prisma.instrument.createMany({
      data: instruments.map((i) => ({
        symbol: i.symbol,
        description: i.description,
        exchange: i.exchange,
        pointValueUsd: i.point_value_usd,
        tickSize: i.tick_size,
        tickValueUsd: i.tick_value_usd,
        initialMarginUsd: i.initial_margin_usd,
        maintenanceMarginUsd: i.maintenance_margin_usd,
        commissionPerContractUsd: required(
          COMMISSION_PER_CONTRACT_USD[i.symbol],
          `commission rate for ${i.symbol}`,
        ),
      })),
    }),
    prisma.marketPrice.createMany({
      data: marks.map((m) => ({
        symbol: m.symbol,
        markPrice: m.mark_price,
        asOf: new Date(m.as_of),
      })),
    }),
    prisma.fill.createMany({
      data: fills.map((f) => ({
        id: f.id,
        brokerId: required(brokerOfAccount.get(f.account_id), `account ${f.account_id}`),
        accountId: f.account_id,
        instrumentSymbol: f.instrument_symbol,
        side: oneOf(Side, f.side),
        quantity: Number(f.quantity),
        price: f.price,
        filledAt: new Date(f.filled_at),
        orderId: f.order_id,
        liquidity: oneOf(Liquidity, f.liquidity),
        commissionUsd: f.commission_usd,
      })),
    }),
  ]);

  console.log(
    `Seeded ${brokers.length} brokers, ${traders.length} traders, ${accounts.length} accounts, ` +
      `${instruments.length} instruments, ${marks.length} marks, ${fills.length} fills`,
  );
};

loadDotEnv();
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: required(process.env.OWNER_DATABASE_URL, 'OWNER_DATABASE_URL'),
  }),
});
try {
  await seed(prisma);
} finally {
  await prisma.$disconnect();
}
