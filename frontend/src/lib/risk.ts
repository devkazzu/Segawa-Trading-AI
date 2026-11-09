import { round2, riskAmount, plannedRr } from './calc';
import type { Trade, RiskSettings } from './types';

export interface PositionSizingInput {
  balance: number;
  riskPercent: number;
  riskMode: 'percent' | 'fixed';
  fixedRisk?: number;
  entry: number;
  stopLoss: number;
  tickSize: number;
  tickValue: number;
  contractSize: number;
}

export interface PositionSizingResult {
  riskMoney: number;
  stopDistance: number;
  stopTicks: number;
  lots: number;
  units: number;
  perLotRisk: number;
  valid: boolean;
  message?: string;
}

/** Position sizing from broker specs — identical maths to trade risk accounting. */
export function positionSize(i: PositionSizingInput): PositionSizingResult {
  const riskMoney = i.riskMode === 'fixed' ? (i.fixedRisk ?? 0) : round2((i.balance * i.riskPercent) / 100);
  const stopDistance = Math.abs(i.entry - i.stopLoss);
  const empty: PositionSizingResult = {
    riskMoney, stopDistance: round2(stopDistance), stopTicks: 0, lots: 0, units: 0, perLotRisk: 0, valid: false,
  };
  if (!(i.balance > 0)) return { ...empty, message: 'Account balance must be greater than zero.' };
  if (!(riskMoney > 0)) return { ...empty, message: 'Risk amount must be greater than zero.' };
  if (!(stopDistance > 0)) return { ...empty, message: 'Entry and stop loss must differ.' };
  if (!(i.tickSize > 0) || !(i.tickValue > 0)) return { ...empty, message: 'Tick size and tick value must be greater than zero.' };

  const stopTicks = stopDistance / i.tickSize;
  const perLotRisk = stopTicks * i.tickValue;
  if (!(perLotRisk > 0)) return { ...empty, message: 'Invalid contract specification.' };

  const lots = riskMoney / perLotRisk;
  return {
    riskMoney,
    stopDistance: round2(stopDistance),
    stopTicks: round2(stopTicks),
    lots,
    units: round2(lots * i.contractSize),
    perLotRisk: round2(perLotRisk),
    valid: true,
  };
}

export interface AccountRiskState {
  dailyLoss: number;
  weeklyLoss: number;
  drawdownPct: number;
  tradesToday: number;
  consecutiveLosses: number;
  equity: number;
  dailyLossRemaining: number;
  weeklyLossRemaining: number;
  drawdownRemaining: number;
  breaches: string[];
  warnings: string[];
}

export function accountRiskState(trades: Trade[], settings: RiskSettings, equity: number): AccountRiskState {
  const closed = trades.filter((t) => t.status === 'closed');
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startWeek = (() => {
    const d = new Date(startToday);
    d.setDate(d.getDate() - ((now.getDay() + 6) % 7));
    return d.getTime();
  })();

  const todays = closed.filter((t) => new Date(t.exitTime || t.entryTime).getTime() >= startToday);
  const weeks = closed.filter((t) => new Date(t.exitTime || t.entryTime).getTime() >= startWeek);

  const dayPnl = round2(todays.reduce((s, t) => s + net(t), 0));
  const weekPnl = round2(weeks.reduce((s, t) => s + net(t), 0));
  const dailyLoss = dayPnl < 0 ? Math.abs(dayPnl) : 0;
  const weeklyLoss = weekPnl < 0 ? Math.abs(weekPnl) : 0;

  const peak = Math.max(settings.accountBalance, equity);
  const drawdownPct = peak > 0 ? round2(((peak - equity) / peak) * 100) : 0;

  let consecutiveLosses = 0;
  const desc = [...closed].sort((a, b) => +new Date(b.exitTime || b.entryTime) - +new Date(a.exitTime || a.entryTime));
  for (const t of desc) {
    const p = net(t);
    if (p < 0) consecutiveLosses++;
    else break;
  }

  const dailyLossRemaining = round2(settings.dailyLossLimit - dailyLoss);
  const weeklyLossRemaining = round2(settings.weeklyLossLimit - weeklyLoss);
  const drawdownRemaining = round2(settings.maxDrawdown - drawdownPct);

  const breaches: string[] = [];
  const warnings: string[] = [];
  if (dailyLoss >= settings.dailyLossLimit && settings.dailyLossLimit > 0) breaches.push(`Daily loss limit reached (${dailyLoss.toFixed(2)} / ${settings.dailyLossLimit})`);
  else if (settings.dailyLossLimit > 0 && dailyLoss / settings.dailyLossLimit >= 0.7) warnings.push(`You have used ${Math.round((dailyLoss / settings.dailyLossLimit) * 100)}% of your daily loss limit`);

  if (weeklyLoss >= settings.weeklyLossLimit && settings.weeklyLossLimit > 0) breaches.push(`Weekly loss limit reached`);
  else if (settings.weeklyLossLimit > 0 && weeklyLoss / settings.weeklyLossLimit >= 0.7) warnings.push(`You have used ${Math.round((weeklyLoss / settings.weeklyLossLimit) * 100)}% of your weekly loss limit`);

  if (drawdownPct >= settings.maxDrawdown && settings.maxDrawdown > 0) breaches.push(`Maximum drawdown exceeded (${drawdownPct.toFixed(2)}%)`);
  else if (settings.maxDrawdown > 0 && drawdownPct / settings.maxDrawdown >= 0.7) warnings.push(`Drawdown at ${drawdownPct.toFixed(2)}% of the ${settings.maxDrawdown}% limit`);

  if (settings.dailyTradeLimit > 0 && todays.length >= settings.dailyTradeLimit) breaches.push(`Daily trade limit reached (${todays.length}/${settings.dailyTradeLimit})`);
  else if (settings.dailyTradeLimit > 0 && todays.length / settings.dailyTradeLimit >= 0.7) warnings.push(`${todays.length} of ${settings.dailyTradeLimit} daily trades used`);

  if (settings.consecutiveLossAlert > 0 && consecutiveLosses >= settings.consecutiveLossAlert) {
    breaches.push(`${consecutiveLosses} consecutive losses — stop and review`);
  }

  return {
    dailyLoss, weeklyLoss, drawdownPct, tradesToday: todays.length, consecutiveLosses,
    equity, dailyLossRemaining, weeklyLossRemaining, drawdownRemaining, breaches, warnings,
  };
}

function net(t: Trade): number {
  // local helper to avoid a circular import cost at module load
  if (t.status !== 'closed' || t.exitPrice == null) return 0;
  const mult = t.direction === 'buy' ? 1 : -1;
  const vpp = t.tickSize > 0 && t.tickValue > 0 ? (t.tickValue / t.tickSize) * t.lotSize : t.contractSize * t.lotSize;
  return round2((t.exitPrice - t.entryPrice) * mult * vpp - (t.commission + t.swap + t.fees + t.spread));
}

export function riskOfTrade(t: Trade): number {
  return riskAmount(t);
}

export function tradeQualityScore(t: Trade, settings: RiskSettings): { score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 100;
  if (t.stopLoss == null) { score -= 35; notes.push('No stop loss recorded'); }
  const rr = plannedRr(t);
  if (rr != null && rr < 1.5) { score -= 15; notes.push(`Planned R:R is only ${rr.toFixed(2)}`); }
  if (t.riskPercent > settings.maxRiskPerTrade) { score -= 20; notes.push(`Risk ${t.riskPercent}% above the ${settings.maxRiskPerTrade}% cap`); }
  if (!t.strategy) { score -= 10; notes.push('No strategy attached'); }
  if (!t.setup) { score -= 5; notes.push('No setup recorded'); }
  const failedRules = Object.entries(t.ruleChecklist || {}).filter(([, v]) => v === false);
  if (failedRules.length) { score -= Math.min(20, failedRules.length * 5); notes.push(`${failedRules.length} rule check(s) failed`); }
  if (!t.notes) { score -= 5; notes.push('No trade notes'); }
  return { score: Math.max(0, Math.min(100, score)), notes };
}

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  accountBalance: 10000,
  maxRiskPerTrade: 1,
  dailyLossLimit: 300,
  weeklyLossLimit: 750,
  maxDrawdown: 10,
  dailyTradeLimit: 5,
  consecutiveLossAlert: 3,
  defaultContractSize: 100,
  defaultTickSize: 0.01,
  defaultTickValue: 1,
  riskPerTradeMode: 'percent',
  fixedRiskAmount: 100,
};
