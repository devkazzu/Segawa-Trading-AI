import type { Market } from './types';

export interface InstrumentSpec {
  symbol: string;
  name: string;
  market: Market;
  contractSize: number;
  tickSize: number;
  tickValue: number;
  quoteCurrency: string;
  pipSize?: number;
}

/**
 * Broker contract specifications. These are editable in Risk Management and on
 * each trade, because brokers differ (1 lot XAUUSD = 100 oz at most brokers,
 * EURUSD = 100,000 units, US30 CFD cash index conventions vary).
 */
export const INSTRUMENTS: InstrumentSpec[] = [
  { symbol: 'XAUUSD', name: 'Gold / US Dollar', market: 'commodities', contractSize: 100, tickSize: 0.01, tickValue: 1, quoteCurrency: 'USD' },
  { symbol: 'XAUEUR', name: 'Gold / Euro', market: 'commodities', contractSize: 100, tickSize: 0.01, tickValue: 1, quoteCurrency: 'EUR' },
  { symbol: 'XAGUSD', name: 'Silver / US Dollar', market: 'commodities', contractSize: 5000, tickSize: 0.001, tickValue: 5, quoteCurrency: 'USD' },
  { symbol: 'USOIL', name: 'WTI Crude Oil', market: 'commodities', contractSize: 1000, tickSize: 0.01, tickValue: 10, quoteCurrency: 'USD' },
  { symbol: 'EURUSD', name: 'Euro / US Dollar', market: 'forex', contractSize: 100000, tickSize: 0.00001, tickValue: 1, quoteCurrency: 'USD', pipSize: 0.0001 },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', market: 'forex', contractSize: 100000, tickSize: 0.00001, tickValue: 1, quoteCurrency: 'USD', pipSize: 0.0001 },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', market: 'forex', contractSize: 100000, tickSize: 0.001, tickValue: 0.67, quoteCurrency: 'JPY', pipSize: 0.01 },
  { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', market: 'forex', contractSize: 100000, tickSize: 0.00001, tickValue: 1, quoteCurrency: 'USD', pipSize: 0.0001 },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', market: 'forex', contractSize: 100000, tickSize: 0.00001, tickValue: 0.73, quoteCurrency: 'CAD', pipSize: 0.0001 },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', market: 'forex', contractSize: 100000, tickSize: 0.00001, tickValue: 1.1, quoteCurrency: 'CHF', pipSize: 0.0001 },
  { symbol: 'NAS100', name: 'Nasdaq 100 Index', market: 'indices', contractSize: 1, tickSize: 0.25, tickValue: 0.25, quoteCurrency: 'USD' },
  { symbol: 'US30', name: 'Dow Jones 30 Index', market: 'indices', contractSize: 1, tickSize: 1, tickValue: 1, quoteCurrency: 'USD' },
  { symbol: 'SPX500', name: 'S&P 500 Index', market: 'indices', contractSize: 1, tickSize: 0.1, tickValue: 0.1, quoteCurrency: 'USD' },
  { symbol: 'GER40', name: 'DAX 40 Index', market: 'indices', contractSize: 1, tickSize: 1, tickValue: 1, quoteCurrency: 'EUR' },
  { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', market: 'crypto', contractSize: 1, tickSize: 0.5, tickValue: 0.5, quoteCurrency: 'USD' },
  { symbol: 'ETHUSD', name: 'Ethereum / US Dollar', market: 'crypto', contractSize: 1, tickSize: 0.1, tickValue: 0.1, quoteCurrency: 'USD' },
  { symbol: 'AAPL', name: 'Apple Inc.', market: 'stocks', contractSize: 1, tickSize: 0.01, tickValue: 0.01, quoteCurrency: 'USD' },
  { symbol: 'TSLA', name: 'Tesla Inc.', market: 'stocks', contractSize: 1, tickSize: 0.01, tickValue: 0.01, quoteCurrency: 'USD' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', market: 'stocks', contractSize: 1, tickSize: 0.01, tickValue: 0.01, quoteCurrency: 'USD' },
];

export const MARKETS: { value: Market; label: string }[] = [
  { value: 'forex', label: 'Forex' },
  { value: 'indices', label: 'Indices' },
  { value: 'commodities', label: 'Commodities' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'stocks', label: 'Stocks' },
];

export const SESSIONS = ['Asian', 'London', 'London/NY Overlap', 'New York', 'Sydney'] as const;
export const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];
export const EMOTIONS = ['Confident', 'Fear', 'Greed', 'FOMO', 'Revenge', 'Impatience', 'Hesitation', 'Overconfidence', 'Stress', 'Discipline'] as const;
export const DEFAULT_RULES = [
  'Confirmed market structure shift',
  'Entry inside planned zone',
  'Stop loss placed before entry',
  'Risk within plan limit',
  'No high-impact news within 15m',
  'Session aligns with strategy',
] as const;
export const STRATEGY_PRESETS = [
  'SMC', 'BOS', 'CHoCH', 'Order Block', 'FVG', 'Liquidity Sweep', 'Breakout',
  'Retest', 'Support/Resistance', 'EMA Trend', 'Trend Following', 'Counter-Trend',
];

export function findInstrument(symbol: string): InstrumentSpec | undefined {
  return INSTRUMENTS.find((i) => i.symbol.toUpperCase() === symbol.toUpperCase());
}

/** Derive a trading session from a UTC timestamp (approximate broker-style sessions). */
export function deriveSession(iso: string): 'Asian' | 'London' | 'London/NY Overlap' | 'New York' | 'Sydney' {
  const h = new Date(iso).getUTCHours() + new Date(iso).getUTCMinutes() / 60;
  if (h >= 7 && h < 12) return 'London';
  if (h >= 12 && h < 16) return 'London/NY Overlap';
  if (h >= 16 && h < 21) return 'New York';
  if (h >= 21 || h < 1) return 'Sydney';
  return 'Asian';
}
