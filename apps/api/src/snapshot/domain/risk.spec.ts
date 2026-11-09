import { d } from '../test-fixtures.js';
import { riskLevel, riskScore } from './risk.js';

describe('riskScore', () => {
  it('is notional as a percentage of balance', () => {
    expect(riskScore(d(39691), d(75000))).toBe(52.9);
  });

  it('caps at 100', () => {
    expect(riskScore(d(500000), d(75000))).toBe(100);
  });

  it('is 0 without exposure', () => {
    expect(riskScore(d(0), d(75000))).toBe(0);
  });

  it('saturates when there is exposure but no balance, instead of dividing by zero', () => {
    expect(riskScore(d(19845.5), d(0))).toBe(100);
  });

  it('is 0 with neither exposure nor balance', () => {
    expect(riskScore(d(0), d(0))).toBe(0);
  });
});

describe('riskLevel', () => {
  it('is high only strictly above 75', () => {
    expect([riskLevel(75), riskLevel(75.1)]).toEqual(['elevated', 'high']);
  });

  it('is elevated only strictly above 50', () => {
    expect([riskLevel(50), riskLevel(50.1)]).toEqual(['normal', 'elevated']);
  });
});
