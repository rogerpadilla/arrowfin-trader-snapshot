import { PrismaPg } from '@prisma/adapter-pg';
import { FILL_EVENT, type FillEvent, SESSION_COOKIE, SOCKET_UNAUTHORIZED } from 'contracts';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { forgeUnsignedToken } from '../src/auth/test-fixtures.js';
import { createApp } from '../src/bootstrap.js';
import { parseAppConfig } from '../src/config/app-config.js';
import { loadDotEnv } from '../src/config/dotenv.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { Database } from '../src/tenancy/database.js';

loadDotEnv();

const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set for the e2e suite`);
  return value;
};

/** Connects with the application's own credentials but around `Database`, i.e. what a careless future query would do. */
const connectAsAppRole = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: requiredEnv('APP_DATABASE_URL') }),
  });

const WEB_ORIGIN = 'http://web.test';
const config = parseAppConfig({
  ...process.env,
  NODE_ENV: 'test',
  ENABLE_DEV_TOOLS: 'true',
  WEB_ORIGINS: WEB_ORIGIN,
  CLOCK_ANCHOR: '2026-08-25T14:30:00Z',
});

const app = await createApp(config);
await app.listen(0);
const address = app.getHttpServer().address();
if (!address || typeof address === 'string') throw new Error('Expected a TCP address');
const baseUrl = `http://localhost:${address.port}`;
const http = () => request(app.getHttpServer());
const database = app.get(Database);
const createdFillIds: string[] = [];

const SMPT_T005 = { brokerId: 'BRK-SMPT', traderId: 'T-005' };
const SMPT_T006 = { brokerId: 'BRK-SMPT', traderId: 'T-006' };
const ARWP_T001 = { brokerId: 'BRK-ARWP', traderId: 'T-001' };

const login = async (identity: { brokerId: string; traderId: string }): Promise<string> => {
  const response = await http().post('/dev/login').send(identity).expect(204);
  const [cookie] = response.get('Set-Cookie')?.[0]?.split(';') ?? [];
  if (!cookie) throw new Error('No session cookie');
  return cookie;
};

const connect = (headers: Record<string, string>): Promise<Socket> =>
  new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: headers,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (error) => {
      socket.close();
      reject(error);
    });
  });

const collectFills = (socket: Socket): FillEvent[] => {
  const received: FillEvent[] = [];
  socket.on(FILL_EVENT, (event: FillEvent) => received.push(event));
  return received;
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

afterAll(async () => {
  const owner = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requiredEnv('OWNER_DATABASE_URL') }),
  });
  await owner.fill.deleteMany({ where: { id: { in: createdFillIds } } });
  await owner.$disconnect();
  await app.close();
});

describe('REST: identity comes from the session, never from the request', () => {
  it('rejects a request without a session', async () => {
    await http().get('/me/snapshot').expect(401);
  });

  it('rejects an unsigned (alg: none) token claiming another tenant', async () => {
    const forged = forgeUnsignedToken(ARWP_T001);

    await http().get('/me/snapshot').set('Cookie', `${SESSION_COOKIE}=${forged}`).expect(401);
  });

  it('does not log a trader in through another broker’s portal', async () => {
    await http().post('/dev/login').send({ brokerId: 'BRK-ARWP', traderId: 'T-005' }).expect(401);
  });

  it('returns only the caller’s own accounts', async () => {
    const cookie = await login(SMPT_T005);

    const response = await http().get('/me/snapshot').set('Cookie', cookie).expect(200);

    expect(response.body).toMatchObject({
      portalName: 'Summit Trader Portal',
      traderId: 'T-005',
      accounts: [{ accountId: 'ACC-1006' }, { accountId: 'ACC-1007' }],
    });
  });

  it('answers 404 for another tenant’s account and for a same-tenant account of another trader', async () => {
    const cookie = await login(SMPT_T005);
    const fill = { instrument_symbol: 'MES', side: 'BUY', quantity: 1, price: 5643.25 };

    await http()
      .post('/dev/fills')
      .set('Cookie', cookie)
      .send({ ...fill, account_id: 'ACC-1001' })
      .expect(404);
    await http()
      .post('/dev/fills')
      .set('Cookie', cookie)
      .send({ ...fill, account_id: 'ACC-1008' })
      .expect(404);
  });
});

describe('Database: RLS holds even when application filters are missing', () => {
  it('returns nothing for another tenant’s account when the query omits broker_id', async () => {
    const fills = await database.withTenant({ brokerId: 'BRK-SMPT' }, (tx) =>
      tx.fill.findMany({ where: { accountId: 'ACC-1001' } }),
    );

    expect(fills).toEqual([]);
  });

  it('only ever sees the scoped tenant, even for an unfiltered query', async () => {
    const brokers = await database.withTenant({ brokerId: 'BRK-SMPT' }, (tx) =>
      tx.fill.groupBy({ by: ['brokerId'], _count: true }),
    );

    expect(brokers.map((b) => b.brokerId)).toEqual(['BRK-SMPT']);
  });

  it('sees no tenant rows from a query that bypasses the tenant transaction (fails closed)', async () => {
    const careless = connectAsAppRole();

    const [fills, accounts] = await Promise.all([careless.fill.count(), careless.account.count()]);
    await careless.$disconnect();

    expect([fills, accounts]).toEqual([0, 0]);
  });

  it('refuses to write a row into another tenant', async () => {
    await expect(
      database.withTenant({ brokerId: 'BRK-SMPT' }, (tx) =>
        tx.fill.create({
          data: {
            id: 'FIL-CROSS-TENANT',
            brokerId: 'BRK-ARWP',
            accountId: 'ACC-1001',
            instrumentSymbol: 'MES',
            side: 'BUY',
            quantity: 1,
            price: '5643.25',
            filledAt: new Date(),
            orderId: 'ORD-CROSS-TENANT',
            liquidity: 'taker',
            commissionUsd: '0',
          },
        }),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe('WebSocket: tenant-scoped at the handshake', () => {
  it('refuses a connection without a session', async () => {
    await expect(connect({ origin: WEB_ORIGIN })).rejects.toThrow(SOCKET_UNAUTHORIZED);
  });

  it('refuses a connection from an origin outside the allowlist', async () => {
    const cookie = await login(SMPT_T005);

    await expect(connect({ origin: 'https://evil.example', cookie })).rejects.toThrow();
  });

  it('delivers a fill only to the trader who owns it', async () => {
    const [ownerCookie, sameBrokerCookie, otherBrokerCookie] = await Promise.all([
      login(SMPT_T005),
      login(SMPT_T006),
      login(ARWP_T001),
    ]);
    const sockets = await Promise.all([
      connect({ origin: WEB_ORIGIN, cookie: ownerCookie }),
      connect({ origin: WEB_ORIGIN, cookie: sameBrokerCookie }),
      connect({ origin: WEB_ORIGIN, cookie: otherBrokerCookie }),
    ]);
    const [owner, sameBroker, otherBroker] = sockets.map(collectFills);

    const response = await http()
      .post('/dev/fills')
      .set('Cookie', ownerCookie)
      .send({
        account_id: 'ACC-1006',
        instrument_symbol: 'MES',
        side: 'BUY',
        quantity: 2,
        price: 5643.25,
      })
      .expect(201);
    await settle();
    createdFillIds.push(...owner.map((fill) => fill.fillId));

    expect(owner).toEqual([response.body]);
    // Exact shape: an extra field (a balance, a name) on the wire would fail this.
    expect(owner).toEqual([
      {
        fillId: expect.any(String),
        accountId: 'ACC-1006',
        symbol: 'MES',
        side: 'BUY',
        quantity: 2,
        price: '5643.25',
        filledAt: expect.any(String),
      },
    ]);
    expect(sameBroker).toEqual([]);
    expect(otherBroker).toEqual([]);
    for (const socket of sockets) socket.close();
  });
});
