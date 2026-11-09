import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Bot, CircleDollarSign, Flame, Gauge, LineChart as LineIcon, Plus,
  Sparkles, Target, TrendingDown, TrendingUp, Trophy, Wallet, Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/layout/AppShell';
import { Button, EmptyState, Metric, ProgressBar, SectionTitle, Stat, Badge, Money } from '../components/ui';
import { EquityChart, DailyPnlChart, MonthlyChart, WinLossDonut, DrawdownChart } from '../components/charts';
import { CalendarHeatmap } from '../components/CalendarHeatmap';
import { RangeFilter, useRange } from '../components/RangeFilter';
import { Mascot, SakuraCorner } from '../components/brand';
import {
  drawdown, equityCurve, filterTrades, fmtDuration, fmtMoney, fmtPct, fmtR, groupPerformance,
  monthKey, monthlyPerformance, netPnl, summarize, dayBuckets, closeTime, rMultiple,
} from '../lib/calc';
import { accountRiskState } from '../lib/risk';
import { runAudit } from '../lib/analysis';

export default function Dashboard() {
  const { snapshot, loadDemoData } = useApp();
  const { preset, setPreset, custom, setCustom, range } = useRange('3m');
  const trades = snapshot.trades;
  const settings = snapshot.riskSettings;
  const currency = snapshot.preferences.currency;

  const scoped = useMemo(() => filterTrades(trades, range), [trades, range]);
  const m = useMemo(() => summarize(scoped, settings.accountBalance), [scoped, settings.accountBalance]);
  const equity = useMemo(() => equityCurve(scoped, settings.accountBalance), [scoped, settings.accountBalance]);
  const dd = useMemo(() => drawdown(scoped, settings.accountBalance), [scoped, settings.accountBalance]);
  const daily = useMemo(() => Object.entries(dayBuckets(scoped)).sort().slice(-30).map(([date, v]) => ({ date, pnl: v.pnl })), [scoped]);
  const months = useMemo(() => monthlyPerformance(scoped, 12), [scoped]);
  const sessions = useMemo(() => groupPerformance(scoped, (t) => t.session), [scoped]);
  const strategies = useMemo(() => groupPerformance(scoped, (t) => t.strategy || 'Unspecified'), [scoped]);
  const riskState = useMemo(() => accountRiskState(trades, settings, settings.accountBalance + summarize(trades, settings.accountBalance).netPnl), [trades, settings]);
  const insight = useMemo(() => runAudit(trades, settings).findings[0], [trades, settings]);
  const allDays = useMemo(() => dayBuckets(trades), [trades]);
  const recent = useMemo(() => [...trades].sort((a, b) => +new Date(closeTime(b)) - +new Date(closeTime(a))).slice(0, 6), [trades]);
  const openTrades = trades.filter((t) => t.status === 'open');
  const todayPnl = useMemo(() => {
    const k = new Date().toISOString().slice(0, 10);
    return Object.entries(dayBuckets(scoped)).find(([d]) => d === k)?.[1].pnl ?? 0;
  }, [scoped]);
  const monthPnl = useMemo(() => {
    const k = monthKey(new Date().toISOString());
    return months.find((x) => x.month === k)?.pnl ?? 0;
  }, [months]);

  if (!trades.length) {
    return (
      <div>
        <PageHeader title={`Welcome, ${snapshot.profile.fullName.split(' ')[0]}`} subtitle="Your workspace is ready. Log your first trade to unlock analytics, the AI coach and risk intelligence." />
        <EmptyState
          illustration={<Mascot size="lg" />}
          title="No trades recorded yet"
          description="Segawa never shows sample numbers as your performance. Add a real trade, or load the clearly-labelled demo dataset to explore every module first."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/journal/new" className="btn-primary"><Plus className="h-4 w-4" /> Log first trade</Link>
              <Button variant="secondary" onClick={() => void loadDemoData()} icon={<Sparkles className="h-4 w-4" />}>Load demo dataset</Button>
            </div>
          }
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Gauge, title: 'Accurate P&L engine', body: 'Tick-based maths using real broker contract specs.' },
            { icon: Bot, title: 'AI coach on your data', body: 'Monthly intelligence and per-trade investigation.' },
            { icon: Target, title: 'Risk & challenge guard', body: 'Daily loss limits, drawdown and prop-firm tracking.' },
          ].map((c) => (
            <div key={c.title} className="card">
              <c.icon className="h-5 w-5 text-primary-neon" />
              <p className="mt-2 text-sm font-semibold">{c.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${snapshot.profile.fullName.split(' ')[0]}`}
        subtitle={`${range.label} · ${m.closedTrades} closed trades · all metrics computed from your saved records`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RangeFilter preset={preset} setPreset={setPreset} custom={custom} setCustom={setCustom} />
            <Link to="/journal/new" className="btn-primary !py-2 text-xs"><Plus className="h-4 w-4" /> Add trade</Link>
          </div>
        }
      />

      {riskState.breaches.length > 0 && (
        <div className="mb-4 rounded-2xl border border-loss/40 bg-loss/10 p-3.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-loss" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-loss">Risk guard triggered</p>
              <ul className="mt-1 space-y-0.5 text-xs text-loss/90">
                {riskState.breaches.map((b) => <li key={b}>• {b}</li>)}
              </ul>
              <Link to="/risk" className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-loss underline">Open risk management <ArrowRight className="h-3 w-3" /></Link>
            </div>
          </div>
        </div>
      )}

      {/* hero */}
      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <div className="card relative overflow-hidden lg:col-span-2">
          <SakuraCorner className="-right-6 -top-6 h-40 w-40" />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Current equity</p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums sm:text-4xl">{fmtMoney(m.currentEquity, currency)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <Badge tone={m.netPnl >= 0 ? 'profit' : 'loss'}>
                  {m.netPnl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {fmtMoney(m.netPnl, currency)} ({fmtPct(m.returnPct)})
                </Badge>
                <span className="text-ink-muted">from {fmtMoney(settings.accountBalance, currency)} start</span>
              </div>
            </div>
            <div className="flex gap-4 text-right">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-ink-muted">Today</p>
                <p className={`font-display text-sm font-semibold ${todayPnl >= 0 ? 'text-profit' : 'text-loss'}`}>{fmtMoney(todayPnl, currency)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-ink-muted">This month</p>
                <p className={`font-display text-sm font-semibold ${monthPnl >= 0 ? 'text-profit' : 'text-loss'}`}>{fmtMoney(monthPnl, currency)}</p>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <EquityChart data={equity} height={190} currency={currency} />
          </div>
        </div>

        <div className="card relative flex flex-col justify-between overflow-hidden">
          <div className="flex items-start gap-3">
            <Mascot size="md" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-sakura">Hiro's read</p>
              <p className="mt-1 text-sm font-semibold leading-snug">
                {insight ? insight.title : 'No mistake pattern detected'}
              </p>
              <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-ink-muted">
                {insight ? insight.evidence : 'Your recorded trades show no repeating risk or execution violation in this period. Keep the checklist complete so this stays measurable.'}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Link to="/coach" className="btn-primary flex-1 !py-2 text-xs"><Bot className="h-4 w-4" /> Ask Hiro</Link>
            <Link to="/audit" className="btn-secondary !py-2 text-xs">Audit</Link>
          </div>
        </div>
      </div>

      {/* stat grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Net P&L" value={fmtMoney(m.netPnl, currency)} tone={m.netPnl >= 0 ? 'profit' : 'loss'} hint={`${m.closedTrades} closed trades`} icon={<CircleDollarSign className="h-4 w-4" />} />
        <Stat label="Win rate" value={`${m.winRate}%`} hint={`${m.wins}W · ${m.losses}L · ${m.breakevens}BE`} icon={<Trophy className="h-4 w-4" />} />
        <Stat label="Profit factor" value={m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)} tone={m.profitFactor >= 1 ? 'profit' : 'loss'} hint={`GP ${fmtMoney(m.grossProfit, currency, 0)} / GL ${fmtMoney(m.grossLoss, currency, 0)}`} icon={<LineIcon className="h-4 w-4" />} />
        <Stat label="Expectancy" value={fmtMoney(m.expectancy, currency)} tone={m.expectancy >= 0 ? 'profit' : 'loss'} hint={`per trade · ${m.avgR.toFixed(2)}R avg`} icon={<Target className="h-4 w-4" />} />
        <Stat label="Max drawdown" value={fmtMoney(m.maxDrawdown, currency)} tone="loss" hint={`${m.maxDrawdownPct}% peak-to-trough`} icon={<TrendingDown className="h-4 w-4" />} />
        <Stat label="Best trade" value={fmtMoney(m.bestTrade, currency)} tone="profit" hint={`Worst ${fmtMoney(m.worstTrade, currency)}`} icon={<Zap className="h-4 w-4" />} />
        <Stat label="Streaks" value={`W${m.maxWinStreak} / L${m.maxLossStreak}`} hint={m.currentStreak === 0 ? 'flat' : m.currentStreak > 0 ? `${m.currentStreak} win streak` : `${Math.abs(m.currentStreak)} loss streak`} icon={<Flame className="h-4 w-4" />} />
        <Stat label="Open positions" value={String(m.openTrades)} hint={openTrades.length ? openTrades.map((t) => t.instrument).join(', ') : 'nothing at risk'} icon={<Wallet className="h-4 w-4" />} />
      </div>

      {/* charts */}
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <SectionTitle title="Daily net P&L" subtitle="Last 30 trading days in range" />
          {daily.length ? <DailyPnlChart data={daily} /> : <p className="py-10 text-center text-xs text-ink-muted">No closed trades in this range.</p>}
        </div>
        <div className="card">
          <SectionTitle title="Win / loss split" subtitle={`${m.closedTrades} closed`} />
          <WinLossDonut wins={m.wins} losses={m.losses} breakevens={m.breakevens} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Metric label="Avg win" value={fmtMoney(m.avgWin, currency)} tone="profit" />
            <Metric label="Avg loss" value={fmtMoney(m.avgLoss, currency)} tone="loss" />
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <SectionTitle title="Monthly performance" subtitle="Net P&L bars vs win-rate line" />
          {months.length ? <MonthlyChart data={months} /> : <p className="py-10 text-center text-xs text-ink-muted">No monthly data yet.</p>}
        </div>
        <div className="card">
          <SectionTitle title="Drawdown" subtitle={`Max ${fmtMoney(dd.max, currency)} (${dd.maxPct}%)`} />
          <DrawdownChart data={dd.series} height={200} />
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="card">
          <SectionTitle title="Calendar heatmap" subtitle="Every recorded trading day" />
          <CalendarHeatmap days={allDays} />
        </div>
        <div className="card">
          <SectionTitle title="Session performance" />
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.name}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{s.name}</span>
                  <span className={s.pnl >= 0 ? 'text-profit' : 'text-loss'}>{fmtMoney(s.pnl, currency, 0)}</span>
                </div>
                <ProgressBar className="mt-1.5" value={Math.abs(s.pnl)} max={Math.max(1, ...sessions.map((x) => Math.abs(x.pnl)))} tone={s.pnl >= 0 ? 'profit' : 'loss'} />
                <p className="mt-1 text-[10px] text-ink-muted">{s.trades} trades · {s.winRate}% wins · {s.avgR.toFixed(2)}R avg</p>
              </div>
            ))}
            {!sessions.length && <p className="text-xs text-ink-muted">No data.</p>}
          </div>
        </div>
        <div className="card">
          <SectionTitle title="Strategy performance" />
          <div className="space-y-2.5">
            {strategies.slice(0, 6).map((s) => (
              <div key={s.name} className="flex items-center justify-between gap-2 rounded-lg border border-line/50 bg-bg-alt/50 px-2.5 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{s.name}</p>
                  <p className="text-[10px] text-ink-muted">{s.trades} trades · {s.winRate}%</p>
                </div>
                <Money value={s.pnl} currency={currency} className="text-xs font-semibold" />
              </div>
            ))}
            {!strategies.length && <p className="text-xs text-ink-muted">No data.</p>}
          </div>
        </div>
      </div>

      {/* risk snapshot */}
      <div className="mt-3 card">
        <SectionTitle title="Risk guard" subtitle="Live limits from Risk Management settings" action={<Link to="/risk" className="text-xs font-semibold text-primary-neon hover:underline">Configure</Link>} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <div className="flex justify-between text-[11px] text-ink-muted"><span>Daily loss</span><span>{fmtMoney(riskState.dailyLoss, currency)} / {fmtMoney(settings.dailyLossLimit, currency)}</span></div>
            <ProgressBar className="mt-1.5" value={riskState.dailyLoss} max={settings.dailyLossLimit} tone={riskState.dailyLoss / Math.max(1, settings.dailyLossLimit) > 0.7 ? 'loss' : 'warning'} />
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-ink-muted"><span>Weekly loss</span><span>{fmtMoney(riskState.weeklyLoss, currency)} / {fmtMoney(settings.weeklyLossLimit, currency)}</span></div>
            <ProgressBar className="mt-1.5" value={riskState.weeklyLoss} max={settings.weeklyLossLimit} tone="warning" />
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-ink-muted"><span>Drawdown</span><span>{riskState.drawdownPct}% / {settings.maxDrawdown}%</span></div>
            <ProgressBar className="mt-1.5" value={riskState.drawdownPct} max={settings.maxDrawdown} tone="loss" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-ink-muted">
          <span>Trades today: <strong className="text-ink">{riskState.tradesToday}</strong> / {settings.dailyTradeLimit}</span>
          <span>Consecutive losses: <strong className="text-ink">{riskState.consecutiveLosses}</strong></span>
          <span>Avg risk: <strong className="text-ink">{m.avgRiskPercent}%</strong></span>
          <span>Avg hold: <strong className="text-ink">{fmtDuration(m.avgHoldMinutes)}</strong></span>
          <span>Trading days: <strong className="text-ink">{m.tradingDays}</strong></span>
          <span>Costs: <strong className="text-ink">{fmtMoney(m.totalCosts, currency)}</strong></span>
        </div>
      </div>

      {/* recent trades */}
      <div className="mt-3 card">
        <SectionTitle title="Recent trades" action={<Link to="/journal" className="text-xs font-semibold text-primary-neon hover:underline">Open journal</Link>} />
        <div className="table-wrap">
          <table className="w-full">
            <thead><tr className="border-b border-line/60"><th className="th">Date</th><th className="th">Instrument</th><th className="th">Dir</th><th className="th">Session</th><th className="th text-right">Net P&L</th><th className="th text-right">R</th><th className="th" /></tr></thead>
            <tbody>
              {recent.map((t) => (
                <tr key={t.id} className="border-b border-line/30 last:border-0 hover:bg-elevated/40">
                  <td className="td text-ink-muted">{new Date(closeTime(t)).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</td>
                  <td className="td font-medium">{t.instrument}</td>
                  <td className="td"><Badge tone={t.direction === 'buy' ? 'profit' : 'loss'}>{t.direction.toUpperCase()}</Badge></td>
                  <td className="td text-ink-muted">{t.session}</td>
                  <td className="td text-right">{t.status === 'closed' ? <Money value={netPnl(t)} currency={currency} /> : <Badge tone="primary">open</Badge>}</td>
                  <td className="td text-right">{t.status === 'closed' ? fmtR(rMultiple(t)) : '—'}</td>
                  <td className="td text-right"><Link to={`/journal/${t.id}`} className="text-xs text-primary-neon hover:underline">View</Link></td>
                </tr>
              ))}
              {!recent.length && <tr><td className="td text-ink-muted" colSpan={7}>No trades yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-center text-[10px] text-ink-muted/70">
        Segawa TradeAI computes every figure from your recorded trades. It never executes orders and nothing here is financial advice.
      </p>
    </div>
  );
}
