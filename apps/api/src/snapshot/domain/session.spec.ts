import { tradingSessionStart } from './session.js';

const startOf = (iso: string) => tradingSessionStart(new Date(iso)).toISOString();

describe('tradingSessionStart', () => {
  it('opens at 17:00 Chicago the previous evening during a weekday session (CDT, UTC-5)', () => {
    expect(startOf('2026-08-25T14:30:00Z')).toBe('2026-08-24T22:00:00.000Z');
  });

  it('includes the evening hours that fall on the previous UTC date', () => {
    expect(startOf('2026-08-24T22:00:00Z')).toBe('2026-08-24T22:00:00.000Z');
  });

  it('belongs to the previous session one second before the 17:00 open', () => {
    expect(startOf('2026-08-24T21:59:59Z')).toBe('2026-08-23T22:00:00.000Z');
  });

  it('uses CST (UTC-6) in winter', () => {
    expect(startOf('2026-01-14T15:00:00Z')).toBe('2026-01-13T23:00:00.000Z');
  });

  it('treats the Sunday 17:00 open as the start of the Monday session', () => {
    expect(startOf('2026-08-24T14:00:00Z')).toBe('2026-08-23T22:00:00.000Z');
  });

  it('keeps the Thursday-evening session over the weekend close', () => {
    expect(startOf('2026-08-22T12:00:00Z')).toBe('2026-08-20T22:00:00.000Z');
    expect(startOf('2026-08-21T23:30:00Z')).toBe('2026-08-20T22:00:00.000Z');
    expect(startOf('2026-08-23T18:00:00Z')).toBe('2026-08-20T22:00:00.000Z');
  });
});
