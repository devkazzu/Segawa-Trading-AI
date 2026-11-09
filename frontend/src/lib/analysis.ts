import type { Finding, RiskSettings, Trade, Session } from './types';
import {
  summarize, netPnl, rMultiple, plannedRr, riskAmount, closeTime, isClosed, round2,
  groupPerformance, dayBuckets, dayKey, streakStats, holdingMinutes, totalCosts,
} from './calc';

/* ------------------------------ helpers ------------------------------ */

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const stdev = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const minutesBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 60000;
const sumPnl = (ts: Trade[]) => round2(ts.reduce((s, t) => s + netPnl(t), 0));

function severityOf(frequency: number, impact: number, netTotal: number, riskBreach = false): Finding['severity'] {
  const share = netTotal < 0 ? Math.abs(impact) / Math.abs(netTotal) : impact / Math.max(1, Math.abs(netTotal));
  if (riskBreach || share >= 0.6 || frequency >= 8) return 'critical';
  if (share >= 0.3 || frequency >= 5) return 'high';
  if (frequency >= 2 || share >= 0.1) return 'medium';
  return 'low';
}

/* --------------------------- mistake engine --------------------------- */

export interface AuditResult {
  findings: Finding[];
  metrics: ReturnType<typeof summarize>;
  sessions: ReturnType<typeof groupPerformance>;
  strategies: ReturnType<typeof groupPerformance>;
  setups: ReturnType<typeof groupPerformance>;
  instruments: ReturnType<typeof groupPerformance>;
  psychology: { tag: string; count: number; pnl: number; winRate: number }[];
  disciplineScore: number;
  riskScore: number;
  executionScore: number;
  tradeIds: string[];
}

/**
 * Rule-based mistake detection. Every finding declares whether it is a
 * *verified* fact derived from recorded numbers (verified: true) or an AI/rule
 * *interpretation* based on proxies (verified: false). Nothing here invents
 * trades or prices.
 */
export function detectFindings(trades: Trade[], settings: RiskSettings): Finding[] {
  const closed = trades.filter(isClosed);
  const out: Finding[] = [];
  const netTotal = sumPnl(closed);
  if (!closed.length) return out;

  const closedSorted = [...closed].sort((a, b) => +new Date(closeTime(a)) - +new Date(closeTime(b)));
  type DraftFinding = Omit<Finding, 'severity' | 'frequency' | 'explanation'> & {
    severity?: Finding['severity'];
    frequency?: number;
    explanation?: string;
    riskBreach?: boolean;
  };
  const add = (draft: DraftFinding) => {
    const { riskBreach, severity, frequency: explicitFrequency, explanation, ...rest } = draft;
    const frequency = rest.tradeIds.length || explicitFrequency || 1;
    out.push({
      ...rest,
      explanation: explanation ?? '',
      frequency,
      severity: severity ?? severityOf(frequency, rest.impact, netTotal, riskBreach),
    });
  };

  /* 1. Overtrading ------------------------------------------------------ */
  const days = dayBuckets(closed);
  const perDay = Object.values(days).map((d) => d.count);
  const avgPerDay = mean(perDay);
  const heavyDays = Object.entries(days).filter(([, d]) => d.count >= Math.max(settings.dailyTradeLimit, Math.ceil(avgPerDay * 1.6)) && d.count >= 3);
  if (heavyDays.length) {
    const ids = closed.filter((t) => heavyDays.some(([k]) => k === dayKey(closeTime(t)))).map((t) => t.id);
    const impact = sumPnl(closed.filter((t) => ids.includes(t.id)));
    add({
      id: 'overtrading', title: 'Overtrading', category: 'Discipline', verified: true,
      tradeIds: ids, evidence: `${heavyDays.length} day(s) exceeded your ${settings.dailyTradeLimit}-trade limit or 1.6× your ${avgPerDay.toFixed(1)} trades/day average.`,
      impact, explanation: 'Trade frequency rising above plan usually dilutes setup quality and increases cost drag.',
      correction: `Hard-cap execution at ${settings.dailyTradeLimit} trades/day. Stop after 2 losses and log a review instead of another entry.`,
    });
  }

  /* 2. Revenge trading -------------------------------------------------- */
  const revenge: Trade[] = [];
  for (let i = 1; i < closedSorted.length; i++) {
    const prev = closedSorted[i - 1];
    const cur = closedSorted[i];
    if (netPnl(prev) < 0 && minutesBetween(closeTime(prev), cur.entryTime) <= 30 && cur.riskPercent >= prev.riskPercent) revenge.push(cur);
  }
  if (revenge.length) {
    add({
      id: 'revenge-trading', title: 'Revenge trading', category: 'Psychology', verified: true,
      tradeIds: revenge.map((t) => t.id), impact: sumPnl(revenge),
      evidence: `${revenge.length} trade(s) opened within 30 minutes of a loss without reducing risk.`,
      explanation: 'Re-entering immediately after a loss with equal or larger risk is a textbook revenge pattern and typically has negative expectancy.',
      correction: 'Enforce a 30-minute cool-down after any loss. Require a written setup note before the next entry.',
    });
  }

  /* 3. Impulsive re-entry ---------------------------------------------- */
  const reentry: Trade[] = [];
  for (let i = 1; i < closedSorted.length; i++) {
    if (minutesBetween(closeTime(closedSorted[i - 1]), closedSorted[i].entryTime) <= 5) reentry.push(closedSorted[i]);
  }
  if (reentry.length) {
    add({
      id: 'impulsive-reentry', title: 'Impulsive re-entry', category: 'Discipline', verified: true,
      tradeIds: reentry.map((t) => t.id), impact: sumPnl(reentry),
      evidence: `${reentry.length} trade(s) entered within 5 minutes of the previous exit.`,
      correction: 'Wait for a fresh structure confirmation, not just the previous position closing.',
    });
  }

  /* 4. Unprotected trades (stop-loss manipulation) ----------------------- */
  const noStop = closed.filter((t) => t.stopLoss == null);
  if (noStop.length) {
    add({
      id: 'stop-manipulation', title: 'Missing or manipulated stop loss', category: 'Risk', verified: true, riskBreach: true,
      tradeIds: noStop.map((t) => t.id), impact: sumPnl(noStop),
      evidence: `${noStop.length} closed trade(s) were recorded with no stop loss, so position risk cannot be verified.`,
      explanation: 'Without a stop the loss size is unbounded, which is the single most common cause of account blow-ups.',
      correction: 'Never submit an order without a stop. Log the stop in the journal before entry so risk is provable.',
    });
  }

  /* 5. Excessive risk --------------------------------------------------- */
  const overRisk = closed.filter((t) => t.riskPercent > settings.maxRiskPerTrade);
  if (overRisk.length) {
    add({
      id: 'excessive-risk', title: 'Excessive risk per trade', category: 'Risk', verified: true, riskBreach: true,
      tradeIds: overRisk.map((t) => t.id), impact: sumPnl(overRisk),
      evidence: `${overRisk.length} trade(s) risked above your ${settings.maxRiskPerTrade}% cap (max ${Math.max(...overRisk.map((t) => t.riskPercent)).toFixed(2)}%).`,
      correction: `Cap risk at ${settings.maxRiskPerTrade}% per trade. Use the Risk Management position-size calculator to derive lots from the stop.`,
    });
  }

  /* 6. Lot size inconsistency ------------------------------------------- */
  const lots = closed.map((t) => t.lotSize).filter((l) => l > 0);
  const cv = mean(lots) > 0 ? stdev(lots) / mean(lots) : 0;
  if (lots.length >= 4 && cv > 0.45) {
    add({
      id: 'lot-inconsistency', title: 'Lot-size inconsistency', category: 'Risk', verified: true,
      tradeIds: closed.map((t) => t.id), impact: 0,
      evidence: `Position size varies by ${(cv * 100).toFixed(0)}% around the mean (${mean(lots).toFixed(2)} lots, median ${median(lots).toFixed(2)}).`,
      explanation: 'Erratic sizing makes results incomparable and lets one oversized trade dominate the curve.',
      correction: 'Size every trade from the same risk formula; only the stop distance should change the lots.',
    });
  }

  /* 7. Early exits ------------------------------------------------------- */
  const early = closed.filter((t) => {
    const r = rMultiple(t);
    const rr = plannedRr(t);
    return r != null && rr != null && rr >= 1.5 && r > 0 && r < rr * 0.45;
  });
  if (early.length) {
    add({
      id: 'early-exit', title: 'Early exits before target', category: 'Execution', verified: true,
      tradeIds: early.map((t) => t.id), impact: round2(early.reduce((s, t) => s + Math.max(0, (plannedRr(t) ?? 0) * 0 - netPnl(t)), 0)),
      evidence: `${early.length} winner(s) closed below 45% of their planned R:R, leaving the target untouched.`,
      explanation: 'Cutting winners short caps the reward side of your expectancy equation.',
      correction: 'Pre-commit to partials or a breakeven trail instead of a discretionary close.',
    });
  }

  /* 8. Poor risk/reward -------------------------------------------------- */
  const poorRr = closed.filter((t) => { const rr = plannedRr(t); return rr != null && rr < 1.5; });
  if (poorRr.length) {
    add({
      id: 'poor-rr', title: 'Poor planned risk/reward', category: 'Execution', verified: true,
      tradeIds: poorRr.map((t) => t.id), impact: sumPnl(poorRr),
      evidence: `${poorRr.length} trade(s) had planned R:R below 1.5 (median ${median(poorRr.map((t) => plannedRr(t) ?? 0)).toFixed(2)}).`,
      correction: 'Skip setups that cannot offer at least 1:1.5 to the next liquidity target.',
    });
  }

  /* 9. Emotional trading ------------------------------------------------- */
  const emotionalTags = ['FOMO', 'Revenge', 'Greed', 'Fear', 'Impatience', 'Hesitation', 'Overconfidence', 'Stress'];
  const emotional = closed.filter((t) => (t.emotions || []).some((e) => emotionalTags.includes(e)));
  if (emotional.length) {
    add({
      id: 'emotional-trading', title: 'Emotional-state trades', category: 'Psychology', verified: true,
      tradeIds: emotional.map((t) => t.id), impact: sumPnl(emotional),
      evidence: `${emotional.length} trade(s) carry a negative emotional tag (${[...new Set(emotional.flatMap((t) => t.emotions))].join(', ')}).`,
      correction: 'Treat a negative emotion tag as a no-trade signal and journal the trigger instead.',
    });
  }

  /* 10. Unplanned trades ------------------------------------------------- */
  const unplanned = closed.filter((t) => !t.strategy || !t.setup || !t.notes);
  if (unplanned.length) {
    add({
      id: 'unplanned-trades', title: 'Unplanned / undocumented trades', category: 'Process', verified: true,
      tradeIds: unplanned.map((t) => t.id), impact: sumPnl(unplanned),
      evidence: `${unplanned.length} trade(s) are missing a strategy, setup or note.`,
      correction: 'If it is not written down before entry, it is not a trade — it is a gamble.',
    });
  }

  /* 11. Rule violations -------------------------------------------------- */
  const ruleBreak = closed.filter((t) => Object.values(t.ruleChecklist || {}).some((v) => v === false));
  if (ruleBreak.length) {
    const failed = ruleBreak.flatMap((t) => Object.entries(t.ruleChecklist).filter(([, v]) => !v).map(([k]) => k));
    const top = Object.entries(failed.reduce<Record<string, number>>((a, k) => ({ ...a, [k]: (a[k] ?? 0) + 1 }), {}))
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
    add({
      id: 'rule-violations', title: 'Checklist rule violations', category: 'Discipline', verified: true,
      tradeIds: ruleBreak.map((t) => t.id), impact: sumPnl(ruleBreak),
      evidence: `${ruleBreak.length} trade(s) failed at least one rule. Most missed: ${top.join('; ')}.`,
      correction: 'A failed rule check is an automatic no-trade. Add a screenshot of the confirmation before entering.',
    });
  }

  /* 12. Daily loss limit violations -------------------------------------- */
  const breachedDays = Object.entries(days).filter(([, d]) => d.pnl <= -settings.dailyLossLimit && settings.dailyLossLimit > 0);
  if (breachedDays.length) {
    const ids = closed.filter((t) => breachedDays.some(([k]) => k === dayKey(closeTime(t)))).map((t) => t.id);
    add({
      id: 'daily-loss-breach', title: 'Daily loss limit breached', category: 'Risk', verified: true, riskBreach: true,
      tradeIds: ids, impact: round2(breachedDays.reduce((s, [, d]) => s + d.pnl, 0)),
      evidence: `${breachedDays.length} day(s) finished beyond your ${settings.dailyLossLimit} loss limit.`,
      correction: 'Set a hard daily stop; close the platform when the limit is hit and review the session later.',
    });
  }

  /* 13. Repeated losing setups ------------------------------------------- */
  const bySetup = groupPerformance(closed, (t) => t.setup || 'Unspecified');
  bySetup.filter((s) => s.name !== 'Unspecified' && s.trades >= 3 && s.pnl < 0).forEach((s) => {
    const ids = closed.filter((t) => (t.setup || 'Unspecified') === s.name).map((t) => t.id);
    add({
      id: `losing-setup-${s.name.toLowerCase().replace(/\s+/g, '-')}`, title: `Losing setup repeated: ${s.name}`, category: 'Strategy', verified: true,
      tradeIds: ids, impact: s.pnl,
      evidence: `${s.name}: ${s.trades} trades, ${s.winRate.toFixed(0)}% win rate, ${s.pnl.toFixed(2)} net, ${s.avgR.toFixed(2)}R average.`,
      correction: `Retire ${s.name} until you can replay 10 winning examples on replay data.`,
    });
  });

  /* 14. Poor session selection ------------------------------------------- */
  const bySession = groupPerformance(closed, (t) => t.session);
  bySession.filter((s) => s.trades >= 4 && s.pnl < 0).forEach((s) => {
    const ids = closed.filter((t) => t.session === s.name).map((t) => t.id);
    add({
      id: `session-${s.name.toLowerCase().replace(/[^a-z]/g, '-')}`, title: `Negative expectancy in ${s.name}`, category: 'Session', verified: true,
      tradeIds: ids, impact: s.pnl,
      evidence: `${s.name}: ${s.trades} trades, ${s.winRate.toFixed(0)}% wins, ${s.pnl.toFixed(2)} net.`,
      correction: `Restrict execution to your best session; paper-trade ${s.name} until expectancy turns positive.`,
    });
  });

  /* 15. Overconfidence ---------------------------------------------------- */
  const confident: Trade[] = [];
  for (let i = 2; i < closedSorted.length; i++) {
    const prior = closedSorted.slice(i - 3, i);
    if (prior.every((t) => netPnl(t) > 0)) {
      const avgPriorRisk = mean(prior.map((t) => t.lotSize));
      if (avgPriorRisk > 0 && closedSorted[i].lotSize >= avgPriorRisk * 1.5) confident.push(closedSorted[i]);
    }
  }
  if (confident.length) {
    add({
      id: 'overconfidence', title: 'Risk escalation after wins', category: 'Psychology', verified: true,
      tradeIds: confident.map((t) => t.id), impact: sumPnl(confident),
      evidence: `${confident.length} trade(s) increased size by 50%+ directly after a 3-win streak.`,
      explanation: 'Raising size after a winning run without a rule change is overconfidence, and losing runs follow.',
      correction: 'Keep size constant; only scale after a full period review, not after a streak.',
    });
  }

  /* 16. Counter-trend ----------------------------------------------------- */
  const counter = closed.filter((t) => /counter/i.test(t.strategy) || /counter/i.test(t.setup));
  if (counter.length >= 2) {
    add({
      id: 'counter-trend', title: 'Counter-trend exposure', category: 'Strategy', verified: true,
      tradeIds: counter.map((t) => t.id), impact: sumPnl(counter),
      evidence: `${counter.length} trade(s) were tagged counter-trend (${sumPnl(counter).toFixed(2)} net).`,
      correction: 'Require a structure break plus a retest before fading a trend; otherwise trade with the impulse.',
    });
  }

  /* 17. Unconfirmed entries ---------------------------------------------- */
  const unconfirmed = closed.filter((t) => t.ruleChecklist && t.ruleChecklist['Confirmed market structure shift'] === false);
  if (unconfirmed.length) {
    add({
      id: 'unconfirmed-entry', title: 'Entries without structure confirmation', category: 'Execution', verified: true,
      tradeIds: unconfirmed.map((t) => t.id), impact: sumPnl(unconfirmed),
      evidence: `${unconfirmed.length} entry(ies) were logged without a confirmed market-structure shift.`,
      correction: 'Wait for the BOS/CHoCH close before entry; mark it on the execution screenshot.',
    });
  }

  /* 18. Late entries ------------------------------------------------------ */
  const late = closed.filter((t) => {
    const h = new Date(t.entryTime).getUTCHours() + new Date(t.entryTime).getUTCMinutes() / 60;
    const isLateSession = (t.session as Session) === 'London' && h >= 11.5;
    const isLateNY = (t.session as Session) === 'New York' && h >= 20;
    return isLateSession || isLateNY;
  });
  if (late.length) {
    add({
      id: 'late-entries', title: 'Late entries at session exhaustion', category: 'Execution', verified: false,
      tradeIds: late.map((t) => t.id), impact: sumPnl(late),
      evidence: `${late.length} trade(s) were executed in the final 30-90 minutes of their session (proxy for late entries — not proven from candles).`,
      explanation: 'Late-session entries often chase moves that have already extended, so stops sit in obvious liquidity.',
      correction: 'Set an execution cut-off 90 minutes before the session close.',
    });
  }

  /* 19. Strategy inconsistency ------------------------------------------- */
  const strategyNames = [...new Set(closed.map((t) => t.strategy || 'Unspecified'))];
  if (strategyNames.length >= 6) {
    add({
      id: 'strategy-drift', title: 'Inconsistent strategy execution', category: 'Process', verified: false,
      tradeIds: closed.map((t) => t.id), impact: 0,
      evidence: `${strategyNames.length} different strategies appear across ${closed.length} trades (${strategyNames.slice(0, 6).join(', ')}${strategyNames.length > 6 ? '…' : ''}).`,
      explanation: 'Frequent strategy switching makes it impossible to attribute results and is a proxy for plan-hopping.',
      correction: 'Run one primary model for 20 trades before adding another; track its stats separately.',
    });
  }

  /* 20. FOMO / chasing ---------------------------------------------------- */
  const chasing = closed.filter((t) => (t.emotions || []).includes('FOMO') || (t.emotions || []).includes('Revenge'));
  if (chasing.length) {
    const worst = [...chasing].sort((a, b) => netPnl(a) - netPnl(b))[0];
    add({
      id: 'fomo', title: 'FOMO & chasing behaviour', category: 'Psychology', verified: true,
      tradeIds: chasing.map((t) => t.id), impact: sumPnl(chasing),
      evidence: `${chasing.length} trade(s) tagged FOMO/Revenge. Worst: ${worst.instrument} at ${netPnl(worst).toFixed(2)}.`,
      correction: 'Require price to return to your zone. If missed, the trade does not exist — write it in a missed-setup log.',
    });
  }

  return out.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.tradeIds.length - a.tradeIds.length);
}

const severityRank = (s: Finding['severity']) => ({ low: 1, medium: 2, high: 3, critical: 4 }[s]);

export function runAudit(trades: Trade[], settings: RiskSettings): AuditResult {
  const closed = trades.filter(isClosed);
  const findings = detectFindings(trades, settings);
  const metrics = summarize(trades, settings.accountBalance);

  const psychTags = ['Confident', 'Fear', 'Greed', 'FOMO', 'Revenge', 'Impatience', 'Hesitation', 'Overconfidence', 'Stress', 'Discipline'];
  const psychology = psychTags
    .map((tag) => {
      const list = closed.filter((t) => (t.emotions || []).includes(tag));
      const wins = list.filter((t) => netPnl(t) > 0).length;
      return { tag, count: list.length, pnl: sumPnl(list), winRate: list.length ? round2((wins / list.length) * 100) : 0 };
    })
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count);

  const ruleTotal = closed.reduce((s, t) => s + Object.keys(t.ruleChecklist || {}).length, 0);
  const rulePassed = closed.reduce((s, t) => s + Object.values(t.ruleChecklist || {}).filter(Boolean).length, 0);
  const disciplineScore = ruleTotal ? round2((rulePassed / ruleTotal) * 100) : 0;
  const risky = closed.filter((t) => t.riskPercent > settings.maxRiskPerTrade || t.stopLoss == null).length;
  const riskScore = closed.length ? round2(Math.max(0, 100 - (risky / closed.length) * 100)) : 100;
  const planned = closed.filter((t) => t.strategy && t.setup && t.stopLoss != null).length;
  const executionScore = closed.length ? round2((planned / closed.length) * 100) : 0;

  return {
    findings, metrics,
    sessions: groupPerformance(closed, (t) => t.session),
    strategies: groupPerformance(closed, (t) => t.strategy || 'Unspecified'),
    setups: groupPerformance(closed, (t) => t.setup || 'Unspecified'),
    instruments: groupPerformance(closed, (t) => t.instrument),
    psychology, disciplineScore, riskScore, executionScore,
    tradeIds: closed.map((t) => t.id),
  };
}

/* ------------------------- trade investigation ------------------------- */

export interface InvestigationItem { question: string; verdict: 'good' | 'warning' | 'bad' | 'unknown'; answer: string; verified: boolean }
export interface InvestigationResult { items: InvestigationItem[]; score: number; repeatedMistakes: string[]; improvements: string[] }

export function investigateTrade(trade: Trade, history: Trade[], settings: RiskSettings): InvestigationResult {
  const items: InvestigationItem[] = [];
  const rr = plannedRr(trade);
  const risk = riskAmount(trade);
  const closed = history.filter(isClosed);

  const entryRulesOk = Object.values(trade.ruleChecklist || {}).filter(Boolean).length;
  const entryRulesTotal = Object.keys(trade.ruleChecklist || {}).length;
  items.push({
    question: 'Was the entry valid?',
    verdict: entryRulesTotal === 0 ? 'unknown' : entryRulesOk === entryRulesTotal ? 'good' : 'bad',
    answer: entryRulesTotal === 0
      ? 'No rule checklist was completed for this trade, so entry validity cannot be verified.'
      : `${entryRulesOk}/${entryRulesTotal} checklist rules passed.${entryRulesOk < entryRulesTotal ? ' Failed: ' + Object.entries(trade.ruleChecklist).filter(([, v]) => !v).map(([k]) => k).join('; ') + '.' : ''}`,
    verified: entryRulesTotal > 0,
  });

  items.push({
    question: 'Was the setup followed?',
    verdict: trade.strategy && trade.setup ? 'good' : 'warning',
    answer: trade.strategy && trade.setup
      ? `Strategy “${trade.strategy}” and setup “${trade.setup}” were recorded, so the trade is attributable to a model.`
      : 'Strategy or setup is missing, so this trade cannot be attributed to any model.',
    verified: true,
  });

  items.push({
    question: 'Was the stop loss reasonable?',
    verdict: trade.stopLoss == null ? 'bad' : trade.riskPercent > settings.maxRiskPerTrade ? 'bad' : 'good',
    answer: trade.stopLoss == null
      ? 'No stop loss was recorded — position risk is unmeasurable and unbounded.'
      : `Stop sat ${Math.abs(trade.entryPrice - trade.stopLoss).toFixed(trade.tickSize < 0.01 ? 5 : 2)} from entry, defining ${risk.toFixed(2)} of risk (${trade.riskPercent}% of account, cap ${settings.maxRiskPerTrade}%).`,
    verified: true,
  });

  items.push({
    question: 'Was the target realistic?',
    verdict: rr == null ? 'unknown' : rr >= 1.5 ? 'good' : 'warning',
    answer: rr == null ? 'No take-profit was recorded.' : `Planned reward-to-risk was ${rr.toFixed(2)}R${rr >= 1.5 ? ', inside a tradable range.' : ', below the 1.5R minimum used by this plan.'}`,
    verified: rr != null,
  });

  items.push({
    question: 'Was the risk/reward acceptable?',
    verdict: trade.riskPercent > settings.maxRiskPerTrade ? 'bad' : trade.riskPercent > settings.maxRiskPerTrade * 0.8 ? 'warning' : 'good',
    answer: `Risked ${trade.riskPercent}% of the account${trade.riskPercent > settings.maxRiskPerTrade ? `, above your ${settings.maxRiskPerTrade}% cap` : ', within your plan'}.`,
    verified: true,
  });

  const r = rMultiple(trade);
  const premature = r != null && rr != null && r > 0 && r < rr * 0.45;
  items.push({
    question: 'Was the exit premature?',
    verdict: trade.status !== 'closed' ? 'unknown' : premature ? 'warning' : 'good',
    answer: trade.status !== 'closed'
      ? 'Trade is still open — exit quality cannot be assessed yet.'
      : r == null ? 'Exit recorded without a stop, so R cannot be computed.'
        : `Realised ${r.toFixed(2)}R against a planned ${rr?.toFixed(2) ?? '—'}R.${premature ? ' The position was closed well before the target.' : ''}`,
    verified: trade.status === 'closed' && r != null,
  });

  const emotional = (trade.emotions || []).some((e) => ['FOMO', 'Revenge', 'Greed', 'Fear', 'Stress', 'Impatience'].includes(e));
  items.push({
    question: 'Was the trade emotional?',
    verdict: emotional ? 'bad' : (trade.emotions || []).length ? 'good' : 'unknown',
    answer: emotional
      ? `Tagged with ${trade.emotions.join(', ')} — emotional states correlate with worse outcomes in your own history.`
      : (trade.emotions || []).length ? `Tagged ${trade.emotions.join(', ')}, a neutral/positive state.` : 'No emotional state was recorded for this trade.',
    verified: (trade.emotions || []).length > 0,
  });

  const repeatedMistakes: string[] = [];
  if (trade.stopLoss == null) repeatedMistakes.push('Missing stop loss');
  if (trade.riskPercent > settings.maxRiskPerTrade) repeatedMistakes.push('Risk above plan');
  if (Object.values(trade.ruleChecklist || {}).some((v) => !v)) repeatedMistakes.push('Rule checklist failed');
  if (trade.emotions?.includes('FOMO')) repeatedMistakes.push('FOMO tagging');

  const sameSetup = closed.filter((t) => t.setup && t.setup === trade.setup && t.id !== trade.id);
  const sameSetupLosses = sameSetup.filter((t) => netPnl(t) < 0).length;
  items.push({
    question: 'Has the same mistake happened before?',
    verdict: sameSetupLosses >= 2 ? 'bad' : sameSetupLosses === 1 ? 'warning' : 'unknown',
    answer: sameSetup.length
      ? `“${trade.setup}” has ${sameSetup.length} other recorded trade(s) with ${sameSetupLosses} loser(s).${sameSetupLosses >= 2 ? ' This pattern is repeating.' : ''}`
      : 'No comparable history for this setup yet.',
    verified: sameSetup.length > 0,
  });

  const improvements: string[] = [];
  if (trade.stopLoss == null) improvements.push('Record the stop before entry so risk is always measurable.');
  if (rr != null && rr < 1.5) improvements.push('Only take setups offering at least 1.5R to the next target.');
  if (trade.riskPercent > settings.maxRiskPerTrade) improvements.push(`Bring risk back to ${settings.maxRiskPerTrade}% using the position-size calculator.`);
  if (premature) improvements.push('Hold to target or use a fixed partial-exit rule instead of closing on feel.');
  if (emotional) improvements.push('Add a mandatory 10-minute pause whenever a negative emotional tag is present.');
  if (!trade.notes) improvements.push('Write two sentences on the thesis and the invalidation before entry.');
  if (!improvements.length) improvements.push('Structure and execution were consistent — repeat this template.');

  const scores: number[] = items.map((i) => (i.verdict === 'good' ? 1 : i.verdict === 'warning' ? 0.5 : i.verdict === 'bad' ? 0 : 0.6));
  const score = round2((scores.reduce((a, b) => a + b, 0) / items.length) * 100);

  return { items, score, repeatedMistakes, improvements };
}

/** Compact, token-efficient factual context for the AI provider. */
export function buildAiContext(trades: Trade[], settings: RiskSettings) {
  const audit = runAudit(trades, settings);
  const m = audit.metrics;
  return {
    metrics: {
      totalTrades: m.totalTrades, closed: m.closedTrades, netPnl: m.netPnl, winRate: m.winRate,
      profitFactor: isFinite(m.profitFactor) ? m.profitFactor : 'infinite', expectancy: m.expectancy,
      avgR: m.avgR, maxDrawdown: m.maxDrawdown, maxDrawdownPct: m.maxDrawdownPct,
      bestTrade: m.bestTrade, worstTrade: m.worstTrade, maxWinStreak: m.maxWinStreak,
      maxLossStreak: m.maxLossStreak, avgTradesPerDay: m.avgTradesPerDay, totalCosts: m.totalCosts,
    },
    sessions: audit.sessions.map((s) => ({ session: s.name, trades: s.trades, pnl: s.pnl, winRate: s.winRate })),
    strategies: audit.strategies.slice(0, 8).map((s) => ({ strategy: s.name, trades: s.trades, pnl: s.pnl, winRate: s.winRate, avgR: s.avgR })),
    setups: audit.setups.slice(0, 8).map((s) => ({ setup: s.name, trades: s.trades, pnl: s.pnl, winRate: s.winRate })),
    instruments: audit.instruments.slice(0, 6).map((s) => ({ instrument: s.name, trades: s.trades, pnl: s.pnl, winRate: s.winRate })),
    psychology: audit.psychology,
    findings: audit.findings.map((f) => ({ id: f.id, title: f.title, severity: f.severity, frequency: f.frequency, impact: round2(f.impact), verified: f.verified })),
    recentTrades: trades.filter(isClosed).slice(-15).map((t) => ({
      id: t.id, instrument: t.instrument, direction: t.direction, session: t.session, strategy: t.strategy,
      setup: t.setup, riskPercent: t.riskPercent, pnl: netPnl(t), r: rMultiple(t), costs: totalCosts(t),
      emotions: t.emotions, tags: Object.entries(t.ruleChecklist || {}).filter(([, v]) => !v).map(([k]) => k),
      holdMinutes: holdingMinutes(t), date: closeTime(t),
    })),
    streaks: streakStats(trades.filter(isClosed)),
    riskSettings: settings,
    dataDisclaimer: 'All figures are computed from the trades this user recorded in Segawa TradeAI. No prices or trades are invented.',
  };
}
