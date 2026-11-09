import type { Trade, DateRange } from './types';

/* ------------------------------------------------------------------ *
 * Core money math. All functions are pure so they can be unit tested.
 * ------------------------------------------------------------------ */

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const dirMult = (t: Pick<Trade, 'direction'>): 1 | -1 => (t.direction === 'buy' ? 1 : -1);

/** Per-point value of the position, derived from broker tick specs. */
export function valuePerPoint(t: Pick<Trade, 'tickSize' | 'tickValue' | 'lotSize' | 'contractSize'>): number {
  if (t.tickSize > 0 && t.tickValue > 0) return (t.tickValue / t.tickSize) * (t.lotSize || 0);
  return (t.contractSize || 0) * (t.lotSize || 0);
}

/** Gross P&L from prices only (before commission/swap/fees/spread). */
export function grossPnl(t: Trade): number {
  if (t.status !== 'closed' || t.exitPrice == null) return 0;
  const diff = (t.exitPrice - t.entryPrice) * dirMult(t);
  return round2(diff * valuePerPoint(t));
}

/** Total non-trading costs (always positive). */
export function totalCosts(t: Pick<Trade, 'commission' | 'swap' | 'fees' | 'spread'>): number {
  return round2((t.commission || 0) + (t.swap || 0) + (t.fees || 0) + (t.spread || 0));
}

/** Net realised P&L: gross minus commission, swap, fees and spread cost. */
export function netPnl(t: Trade): number {
  if (t.status !== 'closed' || t.exitPrice == null) return 0;
  return round2(grossPnl(t) - totalCosts(t));
}

/** Money at risk from entry to stop loss (absolute). */
export function riskAmount(t: Trade): number {
  if (t.stopLoss == null || !isFinite(t.stopLoss)) {
    return t.riskPercent > 0 ? 0 : 0;
  }
  const perUnit = Math.abs(t.entryPrice - t.stopLoss);
  return round2(perUnit * valuePerPoint(t));
}

/** Net R-multiple, computed from actual prices (never from guesswork). */
export function rMultiple(t: Trade): number | null {
  // Only a realised (closed) trade can carry an R-multiple.
  if (t.status !== 'closed' || t.exitPrice == null) return null;
  const risk = riskAmount(t);
  if (!risk || risk <= 0) return null;
  return round2(netPnl(t) / risk);
}

export function plannedRr(t: Pick<Trade, 'entryPrice' | 'stopLoss' | 'takeProfit' | 'direction'>): number | null {
  if (t.stopLoss == null || t.takeProfit == null) return null;
  const risk = Math.abs(t.entryPrice - t.stopLoss);
  const reward = Math.abs(t.takeProfit - t.entryPrice);
  if (risk <= 0) return null;
  return round2(reward / risk);
}

export function holdingMinutes(t: Trade): number | null {
  if (!t.exitTime) return null;
  const ms = new Date(t.exitTime).getTime() - new Date(t.entryTime).getTime();
  return ms > 0 ? Math.round(ms / 60000) : null;
}

export const closeTime = (t: Trade): string => t.exitTime || t.entryTime;
export const isClosed = (t: Trade): boolean => t.status === 'closed';
export const isWin = (t: Trade): boolean => netPnl(t) > 0;
export const isLoss = (t: Trade): boolean => netPnl(t) < 0;

/* ------------------------------------------------------------------ *
 * Metrics
 * ------------------------------------------------------------------ */

export interface Metrics {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  lossRate: number;
  grossProfit: number;
  grossLoss: number;
  netPnl: number;
  totalCosts: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  expectancyR: number;
  avgR: number;
  bestTrade: number;
  worstTrade: number;
  maxWinStreak: number;
  maxLossStreak: number;
  currentStreak: number;
  totalR: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  avgHoldMinutes: number;
  avgRiskPercent: number;
  avgTradesPerDay: number;
  tradingDays: number;
  currentEquity: number;
  returnPct: number;
  recoveryFactor: number;
}

export function summarize(trades: Trade[], startingBalance = 10000): Metrics {
  const closed = trades.filter(isClosed);
  const pnls = closed.map(netPnl);
  const wins = closed.filter((t) => netPnl(t) > 0);
  const losses = closed.filter((t) => netPnl(t) < 0);
  const be = closed.filter((t) => netPnl(t) === 0);

  const grossProfit = round2(wins.reduce((s, t) => s + netPnl(t), 0));
  const grossLoss = round2(Math.abs(losses.reduce((s, t) => s + netPnl(t), 0)));
  const net = round2(pnls.reduce((s, p) => s + p, 0));
  const costs = round2(closed.reduce((s, t) => s + totalCosts(t), 0));

  const rs = closed.map(rMultiple).filter((r): r is number => r != null);
  const avgR = rs.length ? round2(rs.reduce((a, b) => a + b, 0) / rs.length) : 0;
  const totalR = round2(rs.reduce((a, b) => a + b, 0));

  const winRate = closed.length ? round2((wins.length / closed.length) * 100) : 0;
  const lossRate = closed.length ? round2((losses.length / closed.length) * 100) : 0;
  const avgWin = wins.length ? round2(grossProfit / wins.length) : 0;
  const avgLoss = losses.length ? round2(grossLoss / losses.length) : 0;
  const profitFactor = grossLoss > 0 ? round2(grossProfit / grossLoss) : grossProfit > 0 ? Infinity : 0;
  const expectancy = round2((winRate / 100) * avgWin - (lossRate / 100) * avgLoss);

  const dd = drawdown(trades, startingBalance);
  const holds = closed.map(holdingMinutes).filter((m): m is number => m != null);
  const risks = closed.map((t) => t.riskPercent).filter((r) => r > 0);

  const streaks = streakStats(closed);
  const days = dayBuckets(closed);
  const tradingDays = Object.keys(days).length;

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: trades.filter((t) => t.status === 'open').length,
    wins: wins.length,
    losses: losses.length,
    breakevens: be.length,
    winRate,
    lossRate,
    grossProfit,
    grossLoss,
    netPnl: net,
    totalCosts: costs,
    profitFactor,
    avgWin,
    avgLoss,
    expectancy,
    expectancyR: rs.length ? round2(totalR / rs.length) : 0,
    avgR,
    bestTrade: pnls.length ? round2(Math.max(...pnls)) : 0,
    worstTrade: pnls.length ? round2(Math.min(...pnls)) : 0,
    maxWinStreak: streaks.maxWin,
    maxLossStreak: streaks.maxLoss,
    currentStreak: streaks.current,
    totalR,
    maxDrawdown: dd.max,
    maxDrawdownPct: dd.maxPct,
    avgHoldMinutes: holds.length ? Math.round(holds.reduce((a, b) => a + b, 0) / holds.length) : 0,
    avgRiskPercent: risks.length ? round2(risks.reduce((a, b) => a + b, 0) / risks.length) : 0,
    avgTradesPerDay: tradingDays ? round2(closed.length / tradingDays) : 0,
    tradingDays,
    currentEquity: round2(startingBalance + net),
    returnPct: startingBalance > 0 ? round2((net / startingBalance) * 100) : 0,
    recoveryFactor: dd.max > 0 ? round2(net / dd.max) : 0,
  };
}

export interface StreakStats { maxWin: number; maxLoss: number; current: number }

export function streakStats(closedTrades: Trade[]): StreakStats {
  const sorted = [...closedTrades].sort((a, b) => +new Date(closeTime(a)) - +new Date(closeTime(b)));
  let maxWin = 0, maxLoss = 0, cur = 0;
  for (const t of sorted) {
    const p = netPnl(t);
    if (p > 0) cur = cur > 0 ? cur + 1 : 1;
    else if (p < 0) cur = cur < 0 ? cur - 1 : -1;
    else cur = 0;
    maxWin = Math.max(maxWin, cur);
    maxLoss = Math.min(maxLoss, cur);
  }
  return { maxWin, maxLoss: Math.abs(maxLoss), current: cur };
}

export interface EquityPoint { date: string; equity: number; pnl: number; drawdown: number; drawdownPct: number; index: number }

export function equityCurve(trades: Trade[], startingBalance = 10000): EquityPoint[] {
  const closed = trades.filter(isClosed).sort((a, b) => +new Date(closeTime(a)) - +new Date(closeTime(b)));
  let equity = startingBalance;
  let peak = startingBalance;
  const pts: EquityPoint[] = [{ date: 'start', equity, pnl: 0, drawdown: 0, drawdownPct: 0, index: 0 }];
  closed.forEach((t, i) => {
    const p = netPnl(t);
    equity = round2(equity + p);
    peak = Math.max(peak, equity);
    const ddAbs = round2(peak - equity);
    pts.push({
      date: closeTime(t),
      equity,
      pnl: p,
      drawdown: ddAbs,
      drawdownPct: peak > 0 ? round2((ddAbs / peak) * 100) : 0,
      index: i + 1,
    });
  });
  return pts;
}

export function drawdown(trades: Trade[], startingBalance = 10000): { max: number; maxPct: number; series: EquityPoint[] } {
  const series = equityCurve(trades, startingBalance);
  let max = 0, maxPct = 0;
  for (const p of series) {
    if (p.drawdown > max) max = p.drawdown;
    if (p.drawdownPct > maxPct) maxPct = p.drawdownPct;
  }
  return { max: round2(max), maxPct: round2(maxPct), series };
}

/** ISO date (YYYY-MM-DD) in local time — used for calendar buckets. */
export const dayKey = (iso: string): string => {
  const d = new Date(iso);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export function dayBuckets(trades: Trade[]): Record<string, { pnl: number; count: number; wins: number; losses: number }> {
  const out: Record<string, { pnl: number; count: number; wins: number; losses: number }> = {};
  for (const t of trades.filter(isClosed)) {
    const k = dayKey(closeTime(t));
    const p = netPnl(t);
    out[k] ??= { pnl: 0, count: 0, wins: 0, losses: 0 };
    out[k].pnl = round2(out[k].pnl + p);
    out[k].count += 1;
    if (p > 0) out[k].wins += 1;
    if (p < 0) out[k].losses += 1;
  }
  return out;
}

export function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}`;
}

export function monthlyPerformance(trades: Trade[], months = 12): { month: string; label: string; pnl: number; trades: number; winRate: number }[] {
  const buckets: Record<string, { pnl: number; trades: Trade[] }> = {};
  for (const t of trades.filter(isClosed)) {
    const k = monthKey(closeTime(t));
    buckets[k] ??= { pnl: 0, trades: [] };
    buckets[k].pnl = round2(buckets[k].pnl + netPnl(t));
    buckets[k].trades.push(t);
  }
  return Object.keys(buckets)
    .sort()
    .slice(-months)
    .map((k) => {
      const b = buckets[k];
      const wins = b.trades.filter((t) => netPnl(t) > 0).length;
      const [y, m] = k.split('-');
      return {
        month: k,
        label: new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' }),
        pnl: b.pnl,
        trades: b.trades.length,
        winRate: b.trades.length ? round2((wins / b.trades.length) * 100) : 0,
      };
    });
}

export function groupPerformance(trades: Trade[], key: (t: Trade) => string): { name: string; pnl: number; trades: number; wins: number; winRate: number; avgR: number }[] {
  const buckets: Record<string, Trade[]> = {};
  for (const t of trades.filter(isClosed)) {
    const k = key(t) || 'Unspecified';
    (buckets[k] ??= []).push(t);
  }
  return Object.entries(buckets)
    .map(([name, list]) => {
      const wins = list.filter((t) => netPnl(t) > 0).length;
      const rs = list.map(rMultiple).filter((r): r is number => r != null);
      return {
        name,
        pnl: round2(list.reduce((s, t) => s + netPnl(t), 0)),
        trades: list.length,
        wins,
        winRate: round2((wins / list.length) * 100),
        avgR: rs.length ? round2(rs.reduce((a, b) => a + b, 0) / rs.length) : 0,
      };
    })
    .sort((a, b) => b.pnl - a.pnl);
}

/* ------------------------------------------------------------------ *
 * Date ranges & filtering
 * ------------------------------------------------------------------ */

export type RangePreset = 'today' | 'week' | 'month' | 'prev-month' | '3m' | '6m' | 'year' | 'all' | 'custom';

export const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'prev-month', label: 'Previous month' },
  { value: '3m', label: 'Last 3 months' },
  { value: '6m', label: 'Last 6 months' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export function rangeToDates(preset: RangePreset, custom?: { from: string; to: string }, now = new Date()): DateRange {
  const t = startOfDay(now);
  switch (preset) {
    case 'today':
      return { from: t.toISOString(), to: endOfDay(now).toISOString(), label: 'Today' };
    case 'week': {
      const dow = (now.getDay() + 6) % 7; // Monday start
      const from = new Date(t);
      from.setDate(from.getDate() - dow);
      return { from: from.toISOString(), to: endOfDay(now).toISOString(), label: 'This week' };
    }
    case 'month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: from.toISOString(), to: endOfDay(now).toISOString(), label: 'This month' };
    }
    case 'prev-month': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from: from.toISOString(), to: to.toISOString(), label: 'Previous month' };
    }
    case '3m': {
      const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { from: from.toISOString(), to: endOfDay(now).toISOString(), label: 'Last 3 months' };
    }
    case '6m': {
      const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return { from: from.toISOString(), to: endOfDay(now).toISOString(), label: 'Last 6 months' };
    }
    case 'year': {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from: from.toISOString(), to: endOfDay(now).toISOString(), label: 'This year' };
    }
    case 'custom':
      return {
        from: custom?.from ? new Date(custom.from).toISOString() : null,
        to: custom?.to ? new Date(custom.to).toISOString() : null,
        label: 'Custom range',
      };
    default:
      return { from: null, to: null, label: 'All time' };
  }
}

export function inRange(t: Trade, range: DateRange): boolean {
  const when = new Date(closeTime(t)).getTime();
  if (range.from && when < new Date(range.from).getTime()) return false;
  if (range.to && when > new Date(range.to).getTime()) return false;
  return true;
}

export function filterTrades(trades: Trade[], range: DateRange): Trade[] {
  return trades.filter((t) => inRange(t, range));
}

/* ------------------------------------------------------------------ *
 * Calendar heatmap grid (weeks x weekdays)
 * ------------------------------------------------------------------ */

export interface CalendarCell { date: string; pnl: number; count: number; inMonth: boolean; isFuture: boolean; day: number }

export function calendarGrid(year: number, month: number, days: Record<string, { pnl: number; count: number }>): CalendarCell[][] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const start = new Date(year, month, 1 - offset);
  const weeks: CalendarCell[][] = [];
  const today = startOfDay(new Date()).getTime();
  for (let w = 0; w < 6; w++) {
    const row: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d);
      const key = dayKey(cur.toISOString());
      const data = days[key];
      row.push({
        date: key,
        pnl: data ? round2(data.pnl) : 0,
        count: data?.count ?? 0,
        inMonth: cur.getMonth() === month,
        isFuture: cur.getTime() > today,
        day: cur.getDate(),
      });
    }
    weeks.push(row);
  }
  return weeks;
}

/* ------------------------------------------------------------------ *
 * Formatting helpers
 * ------------------------------------------------------------------ */

export const fmtMoney = (n: number, currency = 'USD', digits = 2): string => {
  if (!isFinite(n)) return '∞';
  const sign = n < 0 ? '-' : '';
  return `${sign}${new Intl.NumberFormat('en-US', {
    style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(Math.abs(n))}`;
};

export const fmtNum = (n: number, digits = 2): string =>
  isFinite(n) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n) : '∞';

export const fmtPct = (n: number, digits = 1): string => (isFinite(n) ? `${n >= 0 ? '' : ''}${round2(n).toFixed(digits)}%` : '∞');

export const fmtR = (n: number | null): string => (n == null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(2)}R`);

export const fmtDuration = (mins: number): string => {
  if (!mins) return '—';
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
};

export const fmtDate = (iso: string | null, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }): string =>
  iso ? new Date(iso).toLocaleDateString('en-US', opts) : '—';

export const fmtDateTime = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export const toLocalInput = (iso?: string | null): string => {
  const d = iso ? new Date(iso) : new Date();
  const pad = (v: number) => `${v}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
