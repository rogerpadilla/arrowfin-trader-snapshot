import { aFill, anAccount, d } from '../test-fixtures.js';
import type { Instrument, Mark } from './model.js';
import { buildAccountSnapshot, MissingMarkError } from './snapshot.js';

const instruments = new Map<string, Instrument>([
  [
    'MNQ',
    {
      symbol: 'MNQ',
      description: 'Micro E-mini Nasdaq-100',
      pointValueUsd: d(2),
      commissionPerContractUsd: d('0.70'),
    },
  ],
  [
    'NQ',
    {
      symbol: 'NQ',
      description: 'E-mini Nasdaq-100',
      pointValueUsd: d(20),
      commissionPerContractUsd: d('2.10'),
    },
  ],
]);

const marks = new Map<string, Mark>([
  ['MNQ', { symbol: 'MNQ', price: d('19845.50'), asOf: new Date('2026-08-25T14:30:00Z') }],
  ['NQ', { symbol: 'NQ', price: d('19845.50'), asOf: new Date('2026-08-25T14:30:00Z') }],
]);

const account = anAccount({ type: 'pro', balanceUsd: d(75000) });

const sessionStart = new Date('2026-08-24T22:00:00Z');

describe('buildAccountSnapshot', () => {
  it('values open positions at the mark and combines realized, commissions and unrealized into day P&L', () => {
    const snapshot = buildAccountSnapshot({
      account,
      fills: [
        aFill({
          id: 'F1',
          symbol: 'NQ',
          side: 'BUY',
          quantity: 1,
          price: d(19800),
          commissionUsd: d('2.10'),
        }),
        aFill({
          id: 'F2',
          symbol: 'NQ',
          side: 'SELL',
          quantity: 1,
          price: d(19810),
          commissionUsd: d('2.10'),
        }),
        aFill({ id: 'F3', symbol: 'MNQ', side: 'BUY', quantity: 5, price: d(19840) }),
      ],
      instruments,
      marks,
      sessionStart,
    });

    expect(snapshot.positions).toHaveLength(1);
    const [mnq] = snapshot.positions;
    expect(mnq?.netQuantity).toBe(5);
    expect(mnq?.unrealizedPnlUsd.toString()).toBe('55');
    expect(mnq?.notionalUsd.toString()).toBe('198455');
    expect(snapshot.realizedPnlUsd.toString()).toBe('200');
    expect(snapshot.commissionsUsd.toString()).toBe('4.9');
    expect(snapshot.dayPnlUsd.toString()).toBe('250.1');
    expect(snapshot.riskScore).toBe(100);
    expect(snapshot.ordersToday).toBe(3);
  });

  it('measures exposure gross, so a short adds to risk instead of offsetting a long', () => {
    const snapshot = buildAccountSnapshot({
      account,
      fills: [
        aFill({ id: 'F1', symbol: 'MNQ', side: 'BUY', quantity: 1, price: d(19845.5) }),
        aFill({ id: 'F2', symbol: 'NQ', side: 'SELL', quantity: 1, price: d(19845.5) }),
      ],
      instruments,
      marks,
      sessionStart,
    });

    expect(snapshot.notionalUsd.toString()).toBe('436601');
  });

  it('reports a flat account with no fills as empty and riskless', () => {
    const snapshot = buildAccountSnapshot({ account, fills: [], instruments, marks, sessionStart });

    expect(snapshot.positions).toEqual([]);
    expect(snapshot.dayPnlUsd.toString()).toBe('0');
    expect(snapshot.riskScore).toBe(0);
  });

  it('refuses to value an open position without a mark rather than inventing a price', () => {
    expect(() =>
      buildAccountSnapshot({
        account,
        fills: [aFill({ id: 'F1', symbol: 'MNQ', side: 'BUY', quantity: 1, price: d(19800) })],
        instruments,
        marks: new Map(),
        sessionStart,
      }),
    ).toThrow(MissingMarkError);
  });
});
