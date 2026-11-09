import type { Account, Fill } from '../domain/model.js';
import {
  aFill,
  anAccount,
  d,
  fixedClock,
  marketDataOf,
  MES,
  tradingWith,
} from '../test-fixtures.js';
import { GetTraderSnapshot } from './get-trader-snapshot.js';

const trader = { traderId: 'T-009', brokerId: 'BRK-MRDN' };
const now = new Date('2026-08-25T14:30:00Z');

const buy = (accountId: string, filledAt: string): Fill =>
  aFill({
    id: `F-${accountId}-${filledAt}`,
    accountId,
    side: 'BUY',
    quantity: 1,
    price: d(5600),
    filledAt: new Date(filledAt),
  });

const useCase = (accounts: Account[], fills: Fill[]) =>
  new GetTraderSnapshot(
    tradingWith({ loadBook: async () => ({ portalName: 'Meridian Desk', accounts, fills }) }),
    marketDataOf([MES], [{ symbol: 'MES', price: d('5642.25'), asOf: now }]),
    fixedClock(now),
  );

describe('GetTraderSnapshot', () => {
  it('values each account only with its own fills, in the current session', async () => {
    const snapshot = await useCase(
      [anAccount({ id: 'A1' }), anAccount({ id: 'A2' })],
      [buy('A1', '2026-08-25T10:00:00Z'), buy('A2', '2026-08-25T11:00:00Z')],
    ).execute(trader);

    expect(snapshot.sessionStart.toISOString()).toBe('2026-08-24T22:00:00.000Z');
    expect(snapshot.accounts.map((a) => [a.account.id, a.positions.length, a.fillsToday])).toEqual([
      ['A1', 1, 1],
      ['A2', 1, 1],
    ]);
  });

  it('drops a flat closed account', async () => {
    const snapshot = await useCase(
      [anAccount({ id: 'A1' }), anAccount({ id: 'C1', status: 'closed' })],
      [],
    ).execute(trader);

    expect(snapshot.accounts.map((a) => a.account.id)).toEqual(['A1']);
  });

  it('keeps a closed account that still holds a position, so its risk stays visible', async () => {
    const snapshot = await useCase(
      [anAccount({ id: 'C1', status: 'closed' })],
      [buy('C1', '2026-08-21T10:00:00Z')],
    ).execute(trader);

    expect(snapshot.accounts.map((a) => a.account.id)).toEqual(['C1']);
  });
});
