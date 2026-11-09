import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Pencil, Plus, Target, Trash2, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/layout/AppShell';
import { Badge, Button, ConfirmDialog, EmptyState, Field, Input, Metric, Modal, SectionTitle, Textarea } from '../components/ui';
import { HorizontalBarChart, RDistributionChart } from '../components/charts';
import { useToast } from '../context/ToastContext';
import { fmtMoney, fmtR, groupPerformance, netPnl, rMultiple } from '../lib/calc';
import { uid } from '../lib/db';
import type { Strategy } from '../lib/types';

const PATTERNS = ['SMC', 'BOS', 'CHoCH', 'Order Block', 'FVG', 'Liquidity Sweep', 'Breakout', 'Retest', 'Support/Resistance', 'EMA', 'Trend Following', 'Counter-Trend'];

export default function StrategyAnalysis() {
  const { snapshot, saveStrategy, deleteStrategy } = useApp();
  const toast = useToast();
  const currency = snapshot.preferences.currency;
  const closed = useMemo(() => snapshot.trades.filter((t) => t.status === 'closed'), [snapshot.trades]);

  const [editing, setEditing] = useState<Strategy | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const byStrategy = useMemo(() => groupPerformance(closed, (t) => t.strategy || 'Unspecified'), [closed]);
  const bySetup = useMemo(() => groupPerformance(closed, (t) => t.setup || 'Unspecified'), [closed]);

  const patternStats = useMemo(() => PATTERNS.map((p) => {
    const list = closed.filter((t) => `${t.strategy} ${t.setup}`.toLowerCase().includes(p.toLowerCase()));
    const wins = list.filter((t) => netPnl(t) > 0).length;
    const pnl = list.reduce((s, t) => s + netPnl(t), 0);
    const rs = list.map(rMultiple).filter((r): r is number => r != null);
    return {
      name: p, trades: list.length, wins, pnl,
      winRate: list.length ? (wins / list.length) * 100 : 0,
      avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0,
    };
  }).filter((p) => p.trades > 0).sort((a, b) => b.pnl - a.pnl), [closed]);

  const rDist = useMemo(() => {
    const buckets = ['<-2', '-2..-1', '-1..0', '0..1', '1..2', '2..3', '3+'];
    const counts = buckets.map((b) => ({ bucket: b, count: 0, pnl: 0 }));
    const best = byStrategy[0];
    if (!best) return counts;
    closed.filter((t) => (t.strategy || 'Unspecified') === best.name).forEach((t) => {
      const r = rMultiple(t);
      if (r == null) return;
      const idx = r < -2 ? 0 : r < -1 ? 1 : r < 0 ? 2 : r < 1 ? 3 : r < 2 ? 4 : r < 3 ? 5 : 6;
      counts[idx].count += 1;
    });
    return counts;
  }, [closed, byStrategy]);

  const best = byStrategy[0];
  const worst = byStrategy[byStrategy.length - 1];

  const save = async (s: Strategy) => {
    if (!s.name.trim()) { toast.error('Strategy name is required'); return; }
    await saveStrategy(s);
    setEditing(null);
    toast.success('Strategy saved');
  };

  return (
    <div>
      <PageHeader
        title="Strategy Analysis"
        subtitle="Which models actually make money for you — measured, not remembered."
        actions={<Button size="sm" onClick={() => setEditing({ id: uid(), name: '', description: '', rules: [], createdAt: new Date().toISOString() })} icon={<Plus className="h-4 w-4" />}>New strategy</Button>}
      />

      {!closed.length ? (
        <EmptyState title="No closed trades to compare" description="Tag every trade with a strategy and setup — the comparison engine needs those labels to attribute results." action={<Link to="/journal/new" className="btn-primary"><Target className="h-4 w-4" /> Log a trade</Link>} />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Best strategy" value={best?.name ?? '—'} tone="profit" hint={best ? `${fmtMoney(best.pnl, currency)} · ${best.winRate.toFixed(0)}%` : ''} />
            <Metric label="Weakest strategy" value={worst?.name ?? '—'} tone="loss" hint={worst ? `${fmtMoney(worst.pnl, currency)} · ${worst.winRate.toFixed(0)}%` : ''} />
            <Metric label="Strategies used" value={byStrategy.length} hint="fewer models = clearer attribution" />
            <Metric label="Setups tracked" value={bySetup.filter((s) => s.name !== 'Unspecified').length} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="card">
              <SectionTitle title="Net P&L by strategy" />
              <HorizontalBarChart data={byStrategy.map((s) => ({ name: s.name, pnl: s.pnl }))} height={Math.max(200, byStrategy.length * 36)} />
            </div>
            <div className="card">
              <SectionTitle title="Strategy scoreboard" />
              <div className="table-wrap">
                <table className="w-full">
                  <thead><tr className="border-b border-line/60"><th className="th">Strategy</th><th className="th text-right">Trades</th><th className="th text-right">Win %</th><th className="th text-right">Avg R</th><th className="th text-right">Net</th></tr></thead>
                  <tbody>
                    {byStrategy.map((s) => (
                      <tr key={s.name} className="border-b border-line/30 last:border-0">
                        <td className="td font-medium">{s.name}</td>
                        <td className="td text-right tabular-nums">{s.trades}</td>
                        <td className="td text-right tabular-nums">{s.winRate}%</td>
                        <td className="td text-right tabular-nums text-ink-muted">{s.avgR.toFixed(2)}</td>
                        <td className={clsx('td text-right tabular-nums', s.pnl >= 0 ? 'text-profit' : 'text-loss')}>{fmtMoney(s.pnl, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] text-ink-muted">A model needs ≥ 20 trades before its edge is statistically meaningful.</p>
            </div>
          </div>

          <div className="mt-3 card">
            <SectionTitle title="Setup performance" subtitle="Setups with fewer than 3 trades are noise — shown for completeness" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {bySetup.map((s) => (
                <div key={s.name} className="rounded-xl border border-line/60 bg-bg-alt/50 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium">{s.name}</p>
                    <span className={clsx('text-[11px] font-semibold', s.pnl >= 0 ? 'text-profit' : 'text-loss')}>{fmtMoney(s.pnl, currency, 0)}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-ink-muted">{s.trades} trades · {s.winRate}% wins · {s.avgR.toFixed(2)}R avg</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="card">
              <SectionTitle title="Pattern performance" subtitle="Tags matched across strategy and setup names" />
              <div className="space-y-1.5">
                {patternStats.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 rounded-lg border border-line/50 bg-bg-alt/40 px-2.5 py-2">
                    <span className="flex-1 text-xs font-medium">{p.name}</span>
                    <Badge tone={p.pnl >= 0 ? 'profit' : 'loss'}>{p.trades}</Badge>
                    <span className="w-12 text-right text-[10px] text-ink-muted">{p.winRate.toFixed(0)}%</span>
                    <span className={clsx('w-20 text-right text-[11px] font-semibold', p.pnl >= 0 ? 'text-profit' : 'text-loss')}>{fmtMoney(p.pnl, currency, 0)}</span>
                  </div>
                ))}
                {!patternStats.length && <p className="text-xs text-ink-muted">No pattern tags found. Tag strategies as SMC, OB, FVG, Liquidity Sweep, Breakout etc. to unlock this analysis.</p>}
              </div>
            </div>
            <div className="card">
              <SectionTitle title={`R distribution — ${best?.name ?? 'best strategy'}`} />
              <RDistributionChart data={rDist} height={230} />
              <p className="mt-1 text-[10px] text-ink-muted">A hard left edge at −1R shows your stop is respected; a fat right tail shows your runners pay for the losers.</p>
            </div>
          </div>

          <div className="mt-3 card">
            <SectionTitle title="Strategy library" subtitle="Your documented playbooks" icon={<BookOpen className="h-4 w-4" />} />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {snapshot.strategies.map((s) => {
                const perf = byStrategy.find((p) => p.name === s.name);
                return (
                  <div key={s.id} className="rounded-xl border border-line/60 bg-bg-alt/50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold">{s.name}</p>
                      <div className="flex gap-1">
                        <button onClick={() => setEditing(s)} aria-label="Edit strategy" className="rounded p-1 text-ink-muted hover:text-primary-neon"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setConfirmId(s.id)} aria-label="Delete strategy" className="rounded p-1 text-ink-muted hover:text-loss"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{s.description || 'No description.'}</p>
                    {s.rules.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {s.rules.map((r) => <li key={r} className="text-[10px] text-ink-muted">• {r}</li>)}
                      </ul>
                    )}
                    {perf && <p className="mt-2 text-[10px] text-ink-muted"><TrendingUp className="mr-1 inline h-3 w-3" />{perf.trades} trades · {fmtMoney(perf.pnl, currency, 0)} · {fmtR(perf.avgR)}</p>}
                  </div>
                );
              })}
              {!snapshot.strategies.length && (
                <p className="text-xs text-ink-muted">No documented strategies yet. Add one with its entry rules so every trade can be judged against a written plan.</p>
              )}
            </div>
          </div>
        </>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Strategy playbook" size="md"
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={() => editing && void save(editing)}>Save</Button></>}>
        {editing && (
          <div className="space-y-3">
            <Field label="Name"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="SMC London Sweep" /></Field>
            <Field label="Description"><Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Sweep of Asian range then CHoCH confirmation on M5…" /></Field>
            <Field label="Entry rules" hint="One rule per line"><Textarea value={editing.rules.join('\n')} onChange={(e) => setEditing({ ...editing, rules: e.target.value.split('\n').map((r) => r.trim()).filter(Boolean) })} placeholder={'Asian range marked\nLiquidity sweep\nCHoCH confirmation'} /></Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={Boolean(confirmId)} title="Delete strategy?" message="Trades keep their labels; only the playbook entry is removed." confirmLabel="Delete" danger
        onConfirm={() => { if (confirmId) void deleteStrategy(confirmId).then(() => { toast.success('Strategy deleted'); setConfirmId(null); }); }}
        onCancel={() => setConfirmId(null)} />
    </div>
  );
}
