import type { Account, Fill } from '../domain/model.js';
import { UnknownInstrumentError } from '../domain/snapshot.js';
import { anAccount, fixedClock, marketDataOf, MES, tradingWith } from '../test-fixtures.js';
import type { FillPublisher } from './ports.js';
import { AccountNotFoundError, type NewFill, RecordFill } from './record-fill.js';

const trader = { traderId: 'T-005', brokerId: 'BRK-SMPT' };
const now = new Date('2026-08-25T14:31:00Z');
const order: NewFill = {
  accountId: 'ACC-1006',
  symbol: 'MES',
  side: 'BUY',
  quantity: 3,
  price: '5643.25',
};

const setup = (account: Account | undefined) => {
  const recorded: Fill[] = [];
  const published: Fill[] = [];
  const trading = tradingWith({
    findAccount: async () => account,
    recordFill: async (_, fill) => {
      recorded.push(fill);
    },
  });
  const publisher: FillPublisher = { publish: (_, fill) => published.push(fill) };
  const recordFill = new RecordFill(trading, marketDataOf([MES]), publisher, fixedClock(now));
  return { recordFill, recorded, published };
};

describe('RecordFill', () => {
  it('prices the commission from the instrument fee schedule, stamps the clock, persists and then publishes', async () => {
    const { recordFill, recorded, published } = setup(anAccount({ id: 'ACC-1006' }));

    const fill = await recordFill.execute(trader, order);

    expect(fill.commissionUsd.toString()).toBe('2.1');
    expect(fill.filledAt).toBe(now);
    expect(recorded).toEqual([fill]);
    expect(published).toEqual([fill]);
  });

  it('refuses an account the caller does not own', async () => {
    const { recordFill, published } = setup(undefined);

    await expect(recordFill.execute(trader, order)).rejects.toThrow(AccountNotFoundError);
    expect(published).toEqual([]);
  });

  it('refuses a closed account', async () => {
    const { recordFill } = setup(anAccount({ id: 'ACC-1006', status: 'closed' }));

    await expect(recordFill.execute(trader, order)).rejects.toThrow(AccountNotFoundError);
  });

  it('refuses an unknown contract', async () => {
    const { recordFill } = setup(anAccount({ id: 'ACC-1006' }));

    await expect(recordFill.execute(trader, { ...order, symbol: 'ZZ' })).rejects.toThrow(
      UnknownInstrumentError,
    );
  });
});
