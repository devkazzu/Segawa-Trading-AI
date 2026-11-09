import { useMemo } from 'react';
import { Download, FileDown, Printer } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/layout/AppShell';
import { Badge, EmptyState, Metric, SectionTitle, Tabs } from '../components/ui';
import { DrawdownChart, EquityChart, HorizontalBarChart, MonthlyChart, RDistributionChart, WinLossDonut, DailyPnlChart } from '../components/charts';
import { RangeFilter, useRange } from '../components/RangeFilter';
import { useState } from 'react';
import {
  closeTime, drawdown, equityCurve, filterTrades, fmtDuration, fmtMoney, groupPerformance,
  monthlyPerformance, netPnl, rMultiple, summarize, dayBuckets,
} from '../lib/calc';
import { exportTradesCsv, exportReportPdf, printCurrentView } from '../lib/export';
import { runAudit } from '../lib/analysis';

type Tab = 'overview' | 'breakdown' | 'distribution' | 'timing';

export default function Analytics() {
  const { snapshot } = useApp();
  const { preset, setPreset, custom, setCustom, range } = useRange('3m');
  const [tab, setTab] = useState<Tab>('overview');
  const currency = snapshot.preferences.currency;
  const settings = snapshot.riskSettings;

  const scoped = useMemo(() => filterTrades(snapshot.trades, range), [snapshot.trades, range]);
  const m = useMemo(() => summarize(scoped, settings.accountBalance), [scoped, settings.accountBalance]);
  const equity = useMemo(() => equityCurve(scoped, settings.accountBalance), [scoped, settings.accountBalance]);
  const dd = useMemo(() => drawdown(scoped, settings.accountBalance), [scoped, settings.accountBalance]);
  const months = useMemo(() => monthlyPerformance(scoped, 12), [scoped]);
  const daily = useMemo(() => Object.entries(dayBuckets(scoped)).sort().slice(-40).map(([date, v]) => ({ date, pnl: v.pnl })), [scoped]);

  const byInstrument = useMemo(() => groupPerformance(scoped, (t) => t.instrument), [scoped]);
  const byMarket = useMemo(() => groupPerformance(scoped, (t) => t.market), [scoped]);
  const bySession = useMemo(() => groupPerformance(scoped, (t) => t.session), [scoped]);
  const byStrategy = useMemo(() => groupPerformance(scoped, (t) => t.strategy || 'Unspecified'), [scoped]);
  const bySetup = useMemo(() => groupPerformance(scoped, (t) => t.setup || 'Unspecified'), [scoped]);
  const byTimeframe = useMemo(() => groupPerformance(scoped, (t) => t.timeframe), [scoped]);

  const rDistribution = useMemo(() => {
    const buckets = ['<-2', '-2..-1', '-1..0', '0..1', '1..2', '2..3', '3+'];
    const counts = buckets.map((b) => ({ bucket: b, count: 0, pnl: 0 }));
    scoped.filter((t) => t.status === 'closed').forEach((t) => {
      const r = rMultiple(t);
      if (r == null) return;
      const idx = r < -2 ? 0 : r < -1 ? 1 : r < 0 ? 2 : r < 1 ? 3 : r < 2 ? 4 : r < 3 ? 5 : 6;
      counts[idx].count += 1;
      counts[idx].pnl += netPnl(t);
    });
    return counts;
  }, [scoped]);

  const weekday = useMemo(() => {
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const acc = names.map((name) => ({ name, pnl: 0, trades: 0 }));
    scoped.filter((t) => t.status === 'closed').forEach((t) => {
      const i = (new Date(closeTime(t)).getDay() + 6) % 7;
      acc[i].pnl += netPnl(t);
      acc[i].trades += 1;
    });
    return acc.filter((a) => a.trades > 0);
  }, [scoped]);

  const hour = useMemo(() => {
    const acc = Array.from({ length: 24 }).map((_, h) => ({ name: `${h}:00`, pnl: 0, trades: 0 }));
    scoped.filter((t) => t.status === 'closed').forEach((t) => {
      const h = new Date(t.entryTime).getHours();
      acc[h].pnl += netPnl(t);
      acc[h].trades += 1;
    });
    return acc.filter((a) => a.trades > 0);
  }, [scoped]);

  const audit = useMemo(() => runAudit(scoped, settings), [scoped, settings]);

  const handlePdf = () => {
    exportReportPdf({
      title: 'Analytics report',
      subtitle: `${range.label} · ${scoped.length} trades`,
      ownerName: snapshot.profile.fullName,
      trades: scoped,
      startingBalance: settings.accountBalance,
      findings: audit.findings,
      recommendations: audit.findings.slice(0, 6).map((f) => f.correction),
    }, `segawa-analytics-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (!snapshot.trades.length) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="Deep performance breakdowns from your recorded trades." />
        <EmptyState title="Nothing to analyse yet" description="Analytics activate as soon as you log your first closed trade." action={<a href="#/journal/new" className="btn-primary">Log a trade</a>} />
      </div>
    );
  }

  const table = (title: string, rows: ReturnType<typeof groupPerformance>, showAvgR = true) => (
    <div className="card">
      <SectionTitle title={title} />
      <div className="table-wrap">
        <table className="w-full">
          <thead><tr className="border-b border-line/60"><th className="th">Name</th><th className="th text-right">Trades</th><th className="th text-right">Wins</th><th className="th text-right">Win %</th><th className="th text-right">Net P&amp;L</th>{showAvgR && <th className="th text-right">Avg R</th>}</tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-line/30 last:border-0">
                <td className="td font-medium">{row.name}</td>
                <td className="td text-right tabular-nums">{row.trades}</td>
                <td className="td text-right tabular-nums">{row.wins}</td>
                <td className="td text-right tabular-nums">{row.winRate}%</td>
                <td className={`td text-right tabular-nums ${row.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{fmtMoney(row.pnl, currency)}</td>
                {showAvgR && <td className="td text-right tabular-nums text-ink-muted">{row.avgR.toFixed(2)}</td>}
              </tr>
            ))}
            {!rows.length && <tr><td className="td text-ink-muted" colSpan={showAvgR ? 6 : 5}>No closed trades in range.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle={`${range.label} · ${scoped.length} trades · net ${fmtMoney(m.netPnl, currency)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RangeFilter preset={preset} setPreset={setPreset} custom={custom} setCustom={setCustom} />
            <button onClick={() => exportTradesCsv(scoped, 'segawa-analytics.csv')} className="btn-secondary !py-2 text-xs" title="Export CSV"><Download className="h-4 w-4" /></button>
            <button onClick={handlePdf} className="btn-secondary !py-2 text-xs" title="Export PDF"><FileDown className="h-4 w-4" /></button>
            <button onClick={printCurrentView} className="btn-secondary !py-2 text-xs" title="Print"><Printer className="h-4 w-4" /></button>
          </div>
        }
      />

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'breakdown', label: 'Breakdown' },
          { value: 'distribution', label: 'Distribution' },
          { value: 'timing', label: 'Timing' },
        ]}
      />

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="Net P&L" value={fmtMoney(m.netPnl, currency)} tone={m.netPnl >= 0 ? 'profit' : 'loss'} />
            <Metric label="Win rate" value={`${m.winRate}%`} hint={`${m.wins}W/${m.losses}L`} />
            <Metric label="Profit factor" value={m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)} />
            <Metric label="Expectancy" value={fmtMoney(m.expectancy, currency)} tone={m.expectancy >= 0 ? 'profit' : 'loss'} />
            <Metric label="Avg R" value={m.avgR.toFixed(2)} />
            <Metric label="Max DD" value={`${m.maxDrawdownPct.toFixed(1)}%`} tone="loss" />
            <Metric label="Avg win" value={fmtMoney(m.avgWin, currency)} tone="profit" />
            <Metric label="Avg loss" value={fmtMoney(m.avgLoss, currency)} tone="loss" />
            <Metric label="Best" value={fmtMoney(m.bestTrade, currency)} tone="profit" />
            <Metric label="Worst" value={fmtMoney(m.worstTrade, currency)} tone="loss" />
            <Metric label="Avg hold" value={fmtDuration(m.avgHoldMinutes)} />
            <Metric label="Costs" value={fmtMoney(m.totalCosts, currency)} />
          </div>

          <div className="card">
            <SectionTitle title="Equity curve" subtitle={`${equity.length - 1} closed trades from ${fmtMoney(settings.accountBalance, currency)}`} />
            <EquityChart data={equity} height={300} currency={currency} />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="card lg:col-span-2">
              <SectionTitle title="Monthly performance" />
              <MonthlyChart data={months} height={260} />
            </div>
            <div className="card">
              <SectionTitle title="Outcome split" />
              <WinLossDonut wins={m.wins} losses={m.losses} breakevens={m.breakevens} height={200} />
              <div className="mt-2 text-center text-[11px] text-ink-muted">
                Payoff ratio: <strong className="text-ink">{m.avgLoss ? (m.avgWin / m.avgLoss).toFixed(2) : '—'}</strong> · Recovery factor: <strong className="text-ink">{m.recoveryFactor.toFixed(2)}</strong>
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="card">
              <SectionTitle title="Daily P&L" subtitle="Last 40 trading days" />
              <DailyPnlChart data={daily} height={240} />
            </div>
            <div className="card">
              <SectionTitle title="Drawdown curve" subtitle={`Max ${fmtMoney(dd.max, currency)} (${dd.maxPct}%)`} />
              <DrawdownChart data={dd.series} height={240} />
            </div>
          </div>
        </div>
      )}

      {tab === 'breakdown' && (
        <div className="grid gap-3 lg:grid-cols-2">
          {table('By instrument', byInstrument)}
          {table('By market', byMarket, false)}
          {table('By session', bySession)}
          {table('By strategy', byStrategy)}
          {table('By setup', bySetup)}
          <div className="card">
            <SectionTitle title="Instrument P&L" />
            <HorizontalBarChart data={byInstrument.map((i) => ({ name: i.name, pnl: i.pnl }))} height={Math.max(180, byInstrument.length * 34)} />
          </div>
        </div>
      )}

      {tab === 'distribution' && (
        <div className="space-y-3">
          <div className="card">
            <SectionTitle title="R-multiple distribution" subtitle="How your outcomes cluster around risk" />
            <RDistributionChart data={rDistribution} height={260} />
            <p className="mt-2 text-[11px] text-ink-muted">
              A healthy system has a fat right tail and a hard left edge at −1R. Trades outside −1R mean the stop was not respected.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Trades ≥ 2R" value={String(rDistribution.slice(4).reduce((s, b) => s + b.count, 0))} tone="profit" />
            <Metric label="Trades ≤ −1R" value={String(rDistribution.slice(0, 2).reduce((s, b) => s + b.count, 0))} tone="loss" />
            <Metric label="Total R captured" value={m.totalR.toFixed(2)} />
            <Metric label="Expectancy / trade" value={fmtMoney(m.expectancy, currency)} />
          </div>
          {table('By timeframe', byTimeframe)}
        </div>
      )}

      {tab === 'timing' && (
        <div className="space-y-3">
          <div className="card">
            <SectionTitle title="Weekday performance" subtitle="Net P&L by close day" />
            <HorizontalBarChart data={weekday.map((w) => ({ name: w.name, pnl: Math.round(w.pnl * 100) / 100 }))} height={220} />
          </div>
          <div className="card">
            <SectionTitle title="Entry hour performance" subtitle="Local time of entry" />
            <HorizontalBarChart data={hour.map((h) => ({ name: h.name, pnl: Math.round(h.pnl * 100) / 100 }))} height={Math.max(200, hour.length * 26)} />
          </div>
          {table('By session', bySession)}
          <div className="card">
            <SectionTitle title="Pattern flags in this range" />
            <div className="flex flex-wrap gap-1.5">
              {audit.findings.length ? audit.findings.map((f) => (
                <Badge key={f.id} tone={f.severity === 'critical' ? 'loss' : f.severity === 'high' ? 'warning' : 'neutral'}>
                  {f.title} · {f.severity}
                </Badge>
              )) : <p className="text-xs text-ink-muted">No rule-based patterns detected in this range.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
