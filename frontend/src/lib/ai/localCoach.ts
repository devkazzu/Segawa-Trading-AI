import type { RiskSettings, Trade } from '../types';
import { runAudit } from '../analysis';
import {
  fmtMoney, fmtR, netPnl, rMultiple, groupPerformance, monthKey, closeTime, holdingMinutes, fmtDuration, dayBuckets,
} from '../calc';

/**
 * Offline statistical coach. It is intentionally NOT a fake LLM: it answers a
 * bounded set of questions using the same analytics engine that powers the
 * dashboards, and tells the user plainly when a question needs a live model.
 */
export function localCoachAnswer(question: string, trades: Trade[], settings: RiskSettings): string {
  const q = question.toLowerCase();
  const closed = trades.filter((t) => t.status === 'closed');
  const audit = runAudit(trades, settings);
  const m = audit.metrics;
  const cur = settings.accountBalance;
  const avgOf = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const avgRisk = m.avgRiskPercent;

  if (!closed.length) {
    return '**No closed trades yet** — the analytics engine needs realised trades before it can analyse you.\n\n- Log a trade from **Trade Journal → Add trade** (or load the clearly-labelled demo dataset from Settings).\n- Once you have 10 closed trades I can rank your sessions, strategies and mistake patterns.';
  }

  const header = '> Local statistical analysis — no AI key configured. Every number below is computed from your saved trades; interpretations are marked.';
  const fmtP = m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2);

  const overview = () =>
    [
      header,
      `### Snapshot (${closed.length} closed trades)`,
      `- Net P&L: **${fmtMoney(m.netPnl)}** · Win rate **${m.winRate}%** · Profit factor **${fmtP}**`,
      `- Expectancy per trade: **${fmtMoney(m.expectancy)}** (${m.avgR.toFixed(2)}R average) · Max drawdown **${fmtMoney(m.maxDrawdown)}** (${m.maxDrawdownPct}%)`,
      `- Best ${fmtMoney(m.bestTrade)} · Worst ${fmtMoney(m.worstTrade)} · Streaks W${m.maxWinStreak}/L${m.maxLossStreak}`,
      '',
      '### Highest-impact findings',
      ...audit.findings.slice(0, 4).map((f) => `- **${f.title}** (${f.severity}) — ${f.evidence}${f.impact ? ` Impact: ${fmtMoney(f.impact)}.` : ''}`),
      '',
      '### Next actions',
      ...audit.findings.slice(0, 3).map((f) => `- ${f.correction}`),
    ].join('\n');

  /* ------------------------- intent routing ------------------------- */

  if (/biggest|worst mistake|top mistake|mistake/.test(q)) {
    const top = audit.findings[0];
    if (!top) return `${header}\n\n### Mistakes\nNo rule-based mistake pattern is currently detected. Keep the checklist complete so this stays provable.`;
    return [
      header,
      `### Biggest mistake: ${top.title} (${top.severity})`,
      `- **Frequency:** ${top.frequency} trade${top.frequency === 1 ? '' : 's'}${top.impact ? ` · **Financial impact:** ${fmtMoney(top.impact)}` : ''}`,
      `- **Status:** ${top.verified ? 'Verified from recorded fields' : 'Interpretation based on proxies'}`,
      `- **Evidence:** ${top.evidence}`,
      `- **Why it matters:** ${top.explanation}`,
      `- **Fix:** ${top.correction}`,
      '',
      '### Runner-up patterns',
      ...audit.findings.slice(1, 4).map((f) => `- ${f.title} — ${f.frequency} occurrence(s)${f.impact ? `, ${fmtMoney(f.impact)}` : ''}`),
    ].join('\n');
  }

  if (/session|london|new york|asian|overlap/.test(q)) {
    const rows = audit.sessions;
    const best = rows[0];
    const worst = rows[rows.length - 1];
    return [
      header,
      '### Session breakdown',
      '| Session | Trades | Win rate | Net P&L | Avg R |',
      '|---|---|---|---|---|',
      ...rows.map((s) => `| ${s.name} | ${s.trades} | ${s.winRate}% | ${fmtMoney(s.pnl)} | ${s.avgR.toFixed(2)} |`),
      '',
      `**Verified:** your best session is **${best?.name}** (${best ? fmtMoney(best.pnl) : '—'}); the weakest is **${worst?.name}** (${worst ? fmtMoney(worst.pnl) : '—'}).`,
      `**Action:** cap execution to ${best?.name} for the next 20 trades and log every trade taken outside it.`,
    ].join('\n');
  }

  if (/strateg|setup|model/.test(q)) {
    const byS = audit.strategies.filter((s) => s.trades > 0);
    const best = byS[0];
    return [
      header,
      '### Strategy performance',
      '| Strategy | Trades | Win rate | Net P&L | Avg R |',
      '|---|---|---|---|---|',
      ...byS.map((s) => `| ${s.name} | ${s.trades} | ${s.winRate}% | ${fmtMoney(s.pnl)} | ${s.avgR.toFixed(2)} |`),
      '',
      `**Best:** ${best?.name ?? '—'} ${best ? `(${fmtMoney(best.pnl)}, ${best.winRate}% wins over ${best.trades} trades)` : ''}.`,
      '**Note:** a strategy needs ≥ 20 trades before its edge is statistically meaningful — treat anything smaller as indicative.',
    ].join('\n');
  }

  if (/xauusd|gold/.test(q)) {
    const gold = groupPerformance(closed.filter((t) => t.instrument.toUpperCase() === 'XAUUSD'), () => 'XAUUSD');
    const g = gold[0];
    if (!g) return `${header}\n\nNo XAUUSD trades are recorded yet, so I cannot analyse gold performance.`;
    const goldTrades = closed.filter((t) => t.instrument.toUpperCase() === 'XAUUSD');
    const losing = goldTrades.filter((t) => netPnl(t) < 0);
    const bySession = groupPerformance(goldTrades, (t) => t.session)[0];
    return [
      header,
      `### XAUUSD performance — ${g.trades} trades`,
      `- Net **${fmtMoney(g.pnl)}** · Win rate **${g.winRate}%** · Avg **${g.avgR.toFixed(2)}R**`,
      `- ${losing.length} losing gold trades cost ${fmtMoney(losing.reduce((s, t) => s + netPnl(t), 0))}`,
      `- Best gold session: **${bySession?.name}** (${bySession ? fmtMoney(bySession.pnl) : '—'})`,
      `- Average hold: ${fmtDuration(Math.round(avgOf(goldTrades.map(holdingMinutes).filter((x): x is number => x != null))))}`,
      '',
      '**Interpretation:** losses on gold usually cluster around stop placement and session timing, not the instrument itself. Compare your gold stop distance against your other instruments.',
    ].join('\n');
  }

  if (/last (\d+)|recent|last ten|last 10/.test(q)) {
    const n = Number(q.match(/last (\d+)/)?.[1] ?? 10);
    const last = [...closed].sort((a, b) => +new Date(closeTime(a)) - +new Date(closeTime(b))).slice(-n);
    return [
      header,
      `### Last ${last.length} closed trades`,
      '| Date | Instrument | Dir | Session | P&L | R |',
      '|---|---|---|---|---|---|',
      ...last.map((t) => `| ${new Date(closeTime(t)).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} | ${t.instrument} | ${t.direction.toUpperCase()} | ${t.session} | ${fmtMoney(netPnl(t))} | ${fmtR(rMultiple(t))} |`),
      '',
      `**Sum:** ${fmtMoney(last.reduce((s, t) => s + netPnl(t), 0))} · **Wins:** ${last.filter((t) => netPnl(t) > 0).length}/${last.length}`,
    ].join('\n');
  }

  if (/streak|losing run|consecutive/.test(q)) {
    return [
      header,
      '### Streak analysis',
      `- Current streak: **${m.currentStreak > 0 ? `${m.currentStreak} win${m.currentStreak === 1 ? '' : 's'}` : m.currentStreak < 0 ? `${Math.abs(m.currentStreak)} loss${m.currentStreak === -1 ? '' : 'es'}` : 'flat'}**`,
      `- Longest win streak: **${m.maxWinStreak}** · longest losing streak: **${m.maxLossStreak}**`,
      `- Max drawdown: **${fmtMoney(m.maxDrawdown)}** (${m.maxDrawdownPct}%)`,
      '',
      '**Interpretation:** losing streaks are mathematically expected at your win rate. With a 55% win rate, a 4-loss run occurs roughly every 40 trades. The risk is not the streak, it is the size increase that usually follows it.',
      `**Rule to add:** after ${Math.max(2, settings.consecutiveLossAlert)} consecutive losses, stop for the day.`,
    ].join('\n');
  }

  if (/discipline|improve|psycholog|emotion/.test(q)) {
    return [
      header,
      '### Discipline scorecard',
      `- Checklist compliance: **${audit.disciplineScore}%**`,
      `- Trades with a strategy + setup + stop: **${audit.executionScore}%**`,
      `- Trades inside the risk cap: **${audit.riskScore}%**`,
      '',
      '### Emotional tags vs outcomes',
      ...(audit.psychology.length
        ? audit.psychology.map((p) => `- ${p.tag}: ${p.count} trades · ${p.winRate}% wins · ${fmtMoney(p.pnl)}`)
        : ['- No emotional tags recorded yet.']),
      '',
      '### Highest-leverage discipline fix',
      audit.findings.find((f) => f.category === 'Discipline')?.correction ?? 'Keep completing the rule checklist on every trade — that is what makes this measurable.',
    ].join('\n');
  }

  if (/weekly|week/.test(q)) {
    const days = Object.entries(dayBuckets(closed)).slice(-7);
    return [
      header,
      '### Last 7 recorded trading days',
      ...days.map(([d, v]) => `- ${d}: ${fmtMoney(v.pnl)} across ${v.count} trade(s)`),
      '',
      `**Week total:** ${fmtMoney(days.reduce((s, [, v]) => s + v.pnl, 0))}`,
    ].join('\n');
  }

  if (/month|november|december|january|february|march|april|may|june|july|august|september|october|report/.test(q)) {
    const months: Record<string, Trade[]> = {};
    closed.forEach((t) => { (months[monthKey(closeTime(t))] ??= []).push(t); });
    const latest = Object.keys(months).sort().pop();
    const list = latest ? months[latest] : [];
    const pnl = list.reduce((s, t) => s + netPnl(t), 0);
    const wins = list.filter((t) => netPnl(t) > 0).length;
    return [
      header,
      `### ${latest ? new Date(`${latest}-01T00:00:00`).toLocaleString('en-US', { month: 'long', year: 'numeric' }) : 'Latest period'} audit`,
      `- Trades: **${list.length}** · Wins **${wins}** · Losses **${list.length - wins}** · Win rate **${list.length ? ((wins / list.length) * 100).toFixed(1) : 0}%**`,
      `- Net P&L: **${fmtMoney(pnl)}** · Avg hold ${fmtDuration(Math.round(avgOf(list.map(holdingMinutes).filter((x): x is number => x != null))))}`,
      '',
      '### Detected patterns',
      ...audit.findings.slice(0, 5).map((f) => `- **${f.title}** (${f.severity}) — ${f.evidence}`),
      '',
      'Open **Monthly Audit** for the full report with per-trade evidence and exports.',
    ].join('\n');
  }

  if (/risk|position size|lot/.test(q)) {
    return [
      header,
      '### Risk posture',
      `- Account balance used by the engine: **${fmtMoney(cur)}**`,
      `- Risk cap per trade: **${settings.maxRiskPerTrade}%** · Daily loss limit **${fmtMoney(settings.dailyLossLimit)}** · Max drawdown **${settings.maxDrawdown}%**`,
      `- Your average recorded risk: **${m.avgRiskPercent}%**`,
      '',
      avgRisk > settings.maxRiskPerTrade
        ? `**Verified breach:** average risk exceeds your cap by ${(avgRisk - settings.maxRiskPerTrade).toFixed(2)} points.`
        : '**Verified:** average risk is inside your cap.',
      'Use **Risk Management → Position size** to derive lots from the stop distance instead of choosing lots by feel.',
    ].join('\n');
  }

  return overview();
}

export const SUGGESTED_QUESTIONS = [
  'Analyse my performance this month',
  'What is my biggest trading mistake?',
  'Compare London and New York sessions',
  'Which strategy works best for me?',
  'Why am I losing on XAUUSD?',
  'Analyse my last 10 trades',
  'Explain my losing streak',
  'How can I improve discipline?',
  'Generate a weekly report',
  'Review my risk management',
];
