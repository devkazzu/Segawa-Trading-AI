import { describe, expect, it } from 'vitest';
import {
  calendarGrid, dayKey, drawdown, equityCurve, filterTrades, grossPnl, groupPerformance, monthlyPerformance,
  netPnl, plannedRr, rangeToDates, riskAmount, rMultiple, round2, streakStats, summarize, totalCosts, valuePerPoint,
} from '../lib/calc';
import { mkTrade } from './helpers';

describe('P&L engine', () => {
  it('prices a long XAUUSD trade with tick maths', () => {
    const t = mkTrade({ direction: 'buy', entryPrice: 2380, exitPrice: 2384, lotSize: 0.1 });
    // 4.00 move / 0.01 tick = 400 ticks * $1 * 0.1 lots = $40
    expect(grossPnl(t)).toBe(40);
  });

  it('prices a short XAUUSD trade', () => {
    const t = mkTrade({ direction: 'sell', entryPrice: 2380, exitPrice: 2375, lotSize: 0.5 });
    // 5.00 move * 100 * 0.5 = $250
    expect(grossPnl(t)).toBe(250);
  });

  it('loses on a long that moves against the position', () => {
    const t = mkTrade({ direction: 'buy', entryPrice: 2380, exitPrice: 2377, lotSize: 1 });
    expect(grossPnl(t)).toBe(-300);
  });

  it('handles five-decimal forex pairs', () => {
    const t = mkTrade({
      instrument: 'EURUSD', market: 'forex', entryPrice: 1.085, exitPrice: 1.0875,
      contractSize: 100000, tickSize: 0.00001, tickValue: 1, lotSize: 0.5, stopLoss: 1.083,
    });
    expect(grossPnl(t)).toBe(125); // 0.0025 / 0.00001 * 1 * 0.5
  });

  it('deducts commission, swap, spread and fees from net P&L', () => {
    const t = mkTrade({ commission: 3, swap: -1, spread: 2, fees: 0.5 });
    expect(totalCosts(t)).toBe(4.5);
    expect(grossPnl(t)).toBe(40);
    expect(netPnl(t)).toBe(35.5);
  });

  it('returns zero P&L while a trade is open', () => {
    const t = mkTrade({ status: 'open', exitPrice: null, exitTime: null });
    expect(grossPnl(t)).toBe(0);
    expect(netPnl(t)).toBe(0);
    expect(rMultiple(t)).toBeNull();
  });

  it('derives value per point from tick specs and falls back to contract size', () => {
    expect(valuePerPoint({ tickSize: 0.01, tickValue: 1, lotSize: 0.1, contractSize: 100 })).toBeCloseTo(10);
    expect(valuePerPoint({ tickSize: 0, tickValue: 0, lotSize: 2, contractSize: 100 })).toBe(200);
  });
});

describe('risk & R-multiples', () => {
  it('computes money at risk from the stop distance', () => {
    const t = mkTrade({ entryPrice: 2380, stopLoss: 2376, lotSize: 0.1 });
    expect(riskAmount(t)).toBe(40);
  });

  it('computes R from net P&L and risk', () => {
    const t = mkTrade({ entryPrice: 2380, exitPrice: 2388, stopLoss: 2376, lotSize: 0.1 });
    expect(netPnl(t)).toBe(80);
    expect(riskAmount(t)).toBe(40);
    expect(rMultiple(t)).toBe(2);
  });

  it('returns null R when no stop was recorded', () => {
    expect(rMultiple(mkTrade({ stopLoss: null }))).toBeNull();
  });

  it('computes planned reward-to-risk both directions', () => {
    expect(plannedRr(mkTrade({ entryPrice: 100, stopLoss: 99, takeProfit: 103 }))).toBe(3);
    expect(plannedRr(mkTrade({ direction: 'sell', entryPrice: 100, stopLoss: 101, takeProfit: 97 }))).toBe(3);
    expect(plannedRr(mkTrade({ takeProfit: null }))).toBeNull();
  });
});

describe('performance summary', () => {
  const trades = [
    mkTrade({ exitPrice: 2384, exitTime: '2024-11-01T10:00:00.000Z' }), // +40
    mkTrade({ exitPrice: 2376, exitTime: '2024-11-02T10:00:00.000Z' }), // -40
    mkTrade({ exitPrice: 2390, exitTime: '2024-11-03T10:00:00.000Z' }), // +100
    mkTrade({ exitPrice: 2380, exitTime: '2024-11-04T10:00:00.000Z' }), // break-even
  ];

  it('counts wins, losses and break-evens', () => {
    const m = summarize(trades, 10000);
    expect(m.wins).toBe(2);
    expect(m.losses).toBe(1);
    expect(m.breakevens).toBe(1);
    expect(m.winRate).toBe(50);
  });

  it('computes profit factor, expectancy and averages', () => {
    const m = summarize(trades, 10000);
    expect(m.grossProfit).toBe(140);
    expect(m.grossLoss).toBe(40);
    expect(m.profitFactor).toBe(3.5);
    expect(m.avgWin).toBe(70);
    expect(m.avgLoss).toBe(40);
    // winRate 50% * 70 - lossRate 25% * 40 = 25
    expect(m.expectancy).toBe(25);
    expect(m.lossRate).toBe(25);
    expect(m.netPnl).toBe(100);
    expect(m.currentEquity).toBe(10100);
    expect(m.returnPct).toBe(1);
  });

  it('reports infinite profit factor when there are no losses', () => {
    const m = summarize([mkTrade({ exitPrice: 2384 })], 10000);
    expect(m.profitFactor).toBe(Infinity);
  });

  it('returns a safe zero summary for an empty journal', () => {
    const m = summarize([], 10000);
    expect(m.closedTrades).toBe(0);
    expect(m.winRate).toBe(0);
    expect(m.expectancy).toBe(0);
    expect(m.maxDrawdown).toBe(0);
    expect(Number.isNaN(m.netPnl)).toBe(false);
  });

  it('ignores open trades in closed-trade metrics', () => {
    const m = summarize([...trades, mkTrade({ status: 'open', exitPrice: null, exitTime: null })], 10000);
    expect(m.totalTrades).toBe(5);
    expect(m.closedTrades).toBe(4);
    expect(m.openTrades).toBe(1);
  });
});

describe('equity curve and drawdown', () => {
  const trades = [
    mkTrade({ exitPrice: 2390, exitTime: '2024-11-01T10:00:00.000Z' }), // +100
    mkTrade({ exitPrice: 2360, exitTime: '2024-11-02T10:00:00.000Z' }), // -200
    mkTrade({ exitPrice: 2385, exitTime: '2024-11-03T10:00:00.000Z' }), // +50
  ];

  it('builds a chronological equity curve starting from the balance', () => {
    const curve = equityCurve(trades, 10000);
    expect(curve).toHaveLength(4);
    expect(curve[0].equity).toBe(10000);
    expect(curve[1].equity).toBe(10100);
    expect(curve[2].equity).toBe(9900);
    expect(curve[3].equity).toBe(9950);
  });

  it('measures peak-to-trough drawdown in money and percent', () => {
    const dd = drawdown(trades, 10000);
    expect(dd.max).toBe(200);
    expect(dd.maxPct).toBeCloseTo(1.98, 1);
  });
});

describe('streaks', () => {
  it('tracks max win and loss streaks plus the current streak', () => {
    const trades = [
      mkTrade({ exitPrice: 2384, exitTime: '2024-11-01T10:00:00.000Z' }),
      mkTrade({ exitPrice: 2385, exitTime: '2024-11-02T10:00:00.000Z' }),
      mkTrade({ exitPrice: 2386, exitTime: '2024-11-03T10:00:00.000Z' }),
      mkTrade({ exitPrice: 2370, exitTime: '2024-11-04T10:00:00.000Z' }),
      mkTrade({ exitPrice: 2371, exitTime: '2024-11-05T10:00:00.000Z' }),
    ];
    const s = streakStats(trades);
    expect(s.maxWin).toBe(3);
    expect(s.maxLoss).toBe(2);
    expect(s.current).toBe(-2);
  });
});

describe('grouping and aggregation', () => {
  const trades = [
    mkTrade({ session: 'London', exitPrice: 2384 }),
    mkTrade({ session: 'London', exitPrice: 2376 }),
    mkTrade({ session: 'New York', exitPrice: 2390 }),
  ];

  it('groups performance by an arbitrary key', () => {
    const rows = groupPerformance(trades, (t) => t.session);
    const london = rows.find((r) => r.name === 'London')!;
    expect(london.trades).toBe(2);
    expect(london.pnl).toBe(0);
    expect(rows[0].name).toBe('New York');
  });

  it('aggregates monthly performance', () => {
    const months = monthlyPerformance(
      [
        mkTrade({ exitPrice: 2384, exitTime: '2024-11-02T10:00:00.000Z' }),
        mkTrade({ exitPrice: 2390, exitTime: '2024-12-02T10:00:00.000Z' }),
      ],
      12,
    );
    expect(months.map((m) => m.month)).toEqual(['2024-11', '2024-12']);
    expect(months[0].pnl).toBe(40);
    expect(months[1].pnl).toBe(100);
  });

  it('creates a six-week calendar grid with the 1st in the correct column', () => {
    const grid = calendarGrid(2024, 10, {}); // November 2024 starts on a Friday
    expect(grid).toHaveLength(6);
    const firstRow = grid[0];
    expect(firstRow[4].date).toBe('2024-11-01');
    expect(firstRow[4].inMonth).toBe(true);
  });

  it('formats day keys in local time', () => {
    expect(dayKey(new Date(2024, 10, 5, 12).toISOString())).toBe('2024-11-05');
  });
});

describe('date ranges', () => {
  const now = new Date(2024, 10, 15, 12); // 15 Nov 2024

  it('builds this-month and previous-month ranges', () => {
    const month = rangeToDates('month', undefined, now);
    expect(new Date(month.from!).getDate()).toBe(1);
    expect(new Date(month.from!).getMonth()).toBe(10);

    const prev = rangeToDates('prev-month', undefined, now);
    expect(new Date(prev.from!).getMonth()).toBe(9);
    expect(new Date(prev.to!).getMonth()).toBe(9);
  });

  it('filters trades by range inclusivity', () => {
    const range = rangeToDates('month', undefined, now);
    const inside = mkTrade({ exitTime: new Date(2024, 10, 10, 9).toISOString() });
    const outside = mkTrade({ exitTime: new Date(2024, 9, 10, 9).toISOString() });
    const rows = filterTrades([inside, outside], range);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(inside.id);
  });

  it('rounds monetary values to two decimals', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(-12.3456)).toBe(-12.35);
  });
});
