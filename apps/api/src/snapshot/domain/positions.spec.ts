import { aFill, d } from '../test-fixtures.js';
import { applyFill, FLAT, replayFills } from './positions.js';

const MES_POINT_VALUE = d(5);
const ES_POINT_VALUE = d(50);
const pointValueOf = (symbol: string) => (symbol === 'ES' ? ES_POINT_VALUE : MES_POINT_VALUE);

describe('applyFill', () => {
  it('opens a long position at the fill price', () => {
    const { position, realizedPnlUsd } = applyFill(FLAT, 'BUY', 2, d(5600), MES_POINT_VALUE);

    expect(position.netQuantity).toBe(2);
    expect(position.averagePrice.toString()).toBe('5600');
    expect(realizedPnlUsd.toString()).toBe('0');
  });

  it('averages the entry price when adding to a position', () => {
    const { position } = applyFill(
      { netQuantity: 1, averagePrice: d(5600) },
      'BUY',
      3,
      d(5604),
      MES_POINT_VALUE,
    );

    expect(position.netQuantity).toBe(4);
    expect(position.averagePrice.toString()).toBe('5603');
  });

  it('realizes P&L scaled by the contract point value on a partial close, keeping the average', () => {
    const { position, realizedPnlUsd } = applyFill(
      { netQuantity: 3, averagePrice: d(5600) },
      'SELL',
      2,
      d(5610.25),
      MES_POINT_VALUE,
    );

    expect(position.netQuantity).toBe(1);
    expect(position.averagePrice.toString()).toBe('5600');
    expect(realizedPnlUsd.toString()).toBe('102.5');
  });

  it('realizes a short position gain when buying back lower', () => {
    const { position, realizedPnlUsd } = applyFill(
      { netQuantity: -2, averagePrice: d(5610) },
      'BUY',
      2,
      d(5600),
      ES_POINT_VALUE,
    );

    expect(position.netQuantity).toBe(0);
    expect(realizedPnlUsd.toString()).toBe('1000');
  });

  it('flips from long to short, realizing the closed part and re-basing the remainder at the fill price', () => {
    const { position, realizedPnlUsd } = applyFill(
      { netQuantity: 1, averagePrice: d(5600) },
      'SELL',
      3,
      d(5590),
      MES_POINT_VALUE,
    );

    expect(position.netQuantity).toBe(-2);
    expect(position.averagePrice.toString()).toBe('5590');
    expect(realizedPnlUsd.toString()).toBe('-50');
  });
});

describe('replayFills', () => {
  const sessionStart = new Date('2026-08-24T22:00:00Z');

  it('carries positions opened in a previous session but only counts today in realized P&L and commissions', () => {
    const ledger = replayFills(
      [
        aFill({
          id: 'F1',
          side: 'BUY',
          quantity: 2,
          price: d(5600),
          filledAt: new Date('2026-08-24T15:00:00Z'),
        }),
        aFill({
          id: 'F2',
          side: 'SELL',
          quantity: 1,
          price: d(5620),
          filledAt: new Date('2026-08-24T23:00:00Z'),
        }),
      ],
      pointValueOf,
      sessionStart,
    );

    expect(ledger.positions.get('MES')).toEqual({ netQuantity: 1, averagePrice: d(5600) });
    expect(ledger.realizedPnlUsd.toString()).toBe('100');
    expect(ledger.commissionsUsd.toString()).toBe('0.7');
    expect(ledger.fillsToday).toBe(1);
  });

  it('counts an order filled in several pieces as one order', () => {
    const ledger = replayFills(
      [
        aFill({ id: 'F1', orderId: 'ORD-9', side: 'BUY', quantity: 1, price: d(5600) }),
        aFill({ id: 'F2', orderId: 'ORD-9', side: 'BUY', quantity: 4, price: d(5600.25) }),
      ],
      pointValueOf,
      sessionStart,
    );

    expect(ledger.fillsToday).toBe(2);
    expect(ledger.ordersToday).toBe(1);
  });

  it('keeps instruments of different contract sizes apart', () => {
    const ledger = replayFills(
      [
        aFill({ id: 'F1', symbol: 'ES', side: 'BUY', quantity: 1, price: d(5600) }),
        aFill({ id: 'F2', symbol: 'MES', side: 'SELL', quantity: 1, price: d(5600) }),
        aFill({ id: 'F3', symbol: 'ES', side: 'SELL', quantity: 1, price: d(5601) }),
      ],
      pointValueOf,
      sessionStart,
    );

    expect(ledger.positions.get('ES')).toBeUndefined();
    expect(ledger.positions.get('MES')?.netQuantity).toBe(-1);
    expect(ledger.realizedPnlUsd.toString()).toBe('50');
  });

  it('replays in time order regardless of input order', () => {
    const ledger = replayFills(
      [
        aFill({
          id: 'F2',
          side: 'SELL',
          quantity: 1,
          price: d(5610),
          filledAt: new Date('2026-08-25T10:00:00Z'),
        }),
        aFill({
          id: 'F1',
          side: 'BUY',
          quantity: 1,
          price: d(5600),
          filledAt: new Date('2026-08-25T09:00:00Z'),
        }),
      ],
      pointValueOf,
      sessionStart,
    );

    expect(ledger.realizedPnlUsd.toString()).toBe('50');
  });
});
