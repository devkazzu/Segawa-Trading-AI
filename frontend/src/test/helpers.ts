import type { Trade } from '../lib/types';

let counter = 0;

export function mkTrade(overrides: Partial<Trade> = {}): Trade {
  counter += 1;
  const base: Trade = {
    id: `t${counter}`,
    userId: 'u1',
    accountId: 'main',
    instrument: 'XAUUSD',
    market: 'commodities',
    direction: 'buy',
    entryPrice: 2380,
    exitPrice: 2384,
    stopLoss: 2376,
    takeProfit: 2390,
    lotSize: 0.1,
    quantity: 0.1,
    contractSize: 100,
    tickSize: 0.01,
    tickValue: 1,
    currency: 'USD',
    entryTime: '2024-11-01T08:00:00.000Z',
    exitTime: '2024-11-01T10:00:00.000Z',
    session: 'London',
    timeframe: 'M15',
    strategy: 'SMC',
    setup: 'Order block retest',
    riskPercent: 1,
    commission: 0,
    swap: 0,
    spread: 0,
    fees: 0,
    status: 'closed',
    screenshots: [],
    notes: 'Planned entry from H4 order block.',
    emotions: ['Confident'],
    ruleChecklist: { 'Confirmed market structure shift': true },
    createdAt: '2024-11-01T10:00:00.000Z',
    updatedAt: '2024-11-01T10:00:00.000Z',
  };
  return { ...base, ...overrides };
}
