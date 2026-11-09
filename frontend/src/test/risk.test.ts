import { describe, expect, it } from 'vitest';
import { accountRiskState, DEFAULT_RISK_SETTINGS, positionSize, tradeQualityScore } from '../lib/risk';
import { mkTrade } from './helpers';

describe('position sizing', () => {
  it('sizes XAUUSD from a percentage risk', () => {
    const r = positionSize({ balance: 10000, riskPercent: 1, riskMode: 'percent', entry: 2380, stopLoss: 2376, tickSize: 0.01, tickValue: 1, contractSize: 100 });
    expect(r.riskMoney).toBe(100);
    expect(r.stopTicks).toBe(400);
    expect(r.perLotRisk).toBe(400);
    expect(r.lots).toBeCloseTo(0.25, 6);
    expect(r.units).toBe(25);
    expect(r.valid).toBe(true);
  });

  it('sizes forex from a fixed risk amount', () => {
    const r = positionSize({ balance: 50000, riskPercent: 0, riskMode: 'fixed', fixedRisk: 250, entry: 1.085, stopLoss: 1.083, tickSize: 0.00001, tickValue: 1, contractSize: 100000 });
    expect(r.lots).toBeCloseTo(1.25, 6);
    expect(r.valid).toBe(true);
  });

  it('rejects invalid input instead of returning NaN lots', () => {
    const zeroStop = positionSize({ balance: 10000, riskPercent: 1, riskMode: 'percent', entry: 100, stopLoss: 100, tickSize: 0.01, tickValue: 1, contractSize: 1 });
    expect(zeroStop.valid).toBe(false);
    expect(zeroStop.lots).toBe(0);
    expect(zeroStop.message).toMatch(/differ/i);

    const noBalance = positionSize({ balance: 0, riskPercent: 1, riskMode: 'percent', entry: 100, stopLoss: 99, tickSize: 0.01, tickValue: 1, contractSize: 1 });
    expect(noBalance.valid).toBe(false);
    expect(noBalance.message).toMatch(/balance/i);
  });

  it('scales linearly with risk percentage', () => {
    const base = { balance: 10000, riskMode: 'percent' as const, entry: 2380, stopLoss: 2376, tickSize: 0.01, tickValue: 1, contractSize: 100 };
    const half = positionSize({ ...base, riskPercent: 0.5 });
    const full = positionSize({ ...base, riskPercent: 1 });
    expect(full.lots).toBeCloseTo(half.lots * 2, 6);
  });
});

describe('account risk state', () => {
  const now = new Date();
  const todayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10).toISOString();

  it('flags a breached daily loss limit', () => {
    const trades = [mkTrade({ exitPrice: 2340, exitTime: todayIso, entryTime: todayIso, lotSize: 0.1 })]; // 0.1 lots * 400 ticks = -400
    const state = accountRiskState(trades, { ...DEFAULT_RISK_SETTINGS, dailyLossLimit: 300 }, 9600);
    expect(state.dailyLoss).toBe(400);
    expect(state.breaches.join(' ')).toMatch(/Daily loss limit/i);
    expect(state.dailyLossRemaining).toBe(-100);
  });

  it('counts consecutive losses from the most recent trade backwards', () => {
    const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
    const trades = [
      mkTrade({ exitPrice: 2360, exitTime: hoursAgo(1) }),
      mkTrade({ exitPrice: 2361, exitTime: hoursAgo(2) }),
      mkTrade({ exitPrice: 2390, exitTime: hoursAgo(3) }),
    ];
    const state = accountRiskState(trades, { ...DEFAULT_RISK_SETTINGS, consecutiveLossAlert: 2 }, 9000);
    expect(state.consecutiveLosses).toBe(2);
    expect(state.breaches.join(' ')).toMatch(/consecutive losses/i);
  });

  it('reports a healthy account with no breaches', () => {
    const state = accountRiskState([], DEFAULT_RISK_SETTINGS, 10000);
    expect(state.breaches).toHaveLength(0);
    expect(state.drawdownPct).toBe(0);
    expect(state.tradesToday).toBe(0);
  });

  it('computes drawdown percentage from the equity peak', () => {
    const state = accountRiskState([], { ...DEFAULT_RISK_SETTINGS, maxDrawdown: 10 }, 9000);
    expect(state.drawdownPct).toBe(10);
    expect(state.breaches.join(' ')).toMatch(/drawdown/i);
  });
});

describe('trade quality score', () => {
  it('scores a compliant trade highly', () => {
    const t = mkTrade({ riskPercent: 1, ruleChecklist: { 'Confirmed market structure shift': true } });
    const { score } = tradeQualityScore(t, DEFAULT_RISK_SETTINGS);
    expect(score).toBe(100);
  });

  it('penalises a trade with no stop, oversize risk and no strategy', () => {
    const t = mkTrade({ stopLoss: null, riskPercent: 5, strategy: '', setup: '', notes: '' });
    const { score, notes } = tradeQualityScore(t, DEFAULT_RISK_SETTINGS);
    expect(score).toBeLessThan(45);
    expect(notes.length).toBeGreaterThanOrEqual(3);
  });
});
