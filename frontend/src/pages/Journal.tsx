import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownUp, Copy, Download, Filter, Plus, Search, SlidersHorizontal, Trash2, X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/layout/AppShell';
import { Badge, Button, ConfirmDialog, EmptyState, Input, Money, Select } from '../components/ui';
import { Mascot } from '../components/brand';
import { RangeFilter, useRange } from '../components/RangeFilter';
import { useToast } from '../context/ToastContext';
import {
  closeTime, filterTrades, fmtDateTime, fmtR, netPnl, round2, rMultiple, summarize,
} from '../lib/calc';
import { MARKETS, SESSIONS, STRATEGY_PRESETS } from '../lib/instruments';
import { exportTradesCsv } from '../lib/export';
import type { Market, Trade } from '../lib/types';

type SortKey = 'date' | 'pnl' | 'instrument' | 'r' | 'risk';

export default function Journal() {
  const { snapshot, deleteTrade, duplicateTrade } = useApp();
  const { preset, setPreset, custom, setCustom, range } = useRange('all');
  const toast = useToast();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'open' | 'closed'>('all');
  const [direction, setDirection] = useState<'all' | 'buy' | 'sell'>('all');
  const [market, setMarket] = useState<'all' | Market>('all');
  const [session, setSession] = useState('all');
  const [strategy, setStrategy] = useState('all');
  const [result, setResult] = useState<'all' | 'win' | 'loss' | 'be'>('all');
  const [sort, setSort] = useState<SortKey>('date');
  const [asc, setAsc] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const all = snapshot.trades;
  const currency = snapshot.preferences.currency;

  const strategies = useMemo(() => [...new Set(all.map((t) => t.strategy).filter(Boolean))], [all]);
  const instruments = useMemo(() => [...new Set(all.map((t) => t.instrument))].sort(), [all]);

  const filtered = useMemo(() => {
    let rows = filterTrades(all, range);
    if (status !== 'all') rows = rows.filter((t) => t.status === status);
    if (direction !== 'all') rows = rows.filter((t) => t.direction === direction);
    if (market !== 'all') rows = rows.filter((t) => t.market === market);
    if (session !== 'all') rows = rows.filter((t) => t.session === session);
    if (strategy !== 'all') rows = rows.filter((t) => t.strategy === strategy);
    if (result !== 'all') {
      rows = rows.filter((t) => {
        const p = netPnl(t);
        return result === 'win' ? p > 0 : result === 'loss' ? p < 0 : p === 0;
      });
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((t) =>
        [t.instrument, t.strategy, t.setup, t.notes, t.session, t.market, t.timeframe].some((v) => (v || '').toLowerCase().includes(q)),
      );
    }
    const dir = asc ? 1 : -1;
    return [...rows].sort((a, b) => {
      switch (sort) {
        case 'pnl': return (netPnl(a) - netPnl(b)) * dir;
        case 'r': return ((rMultiple(a) ?? -999) - (rMultiple(b) ?? -999)) * dir;
        case 'risk': return (a.riskPercent - b.riskPercent) * dir;
        case 'instrument': return a.instrument.localeCompare(b.instrument) * dir;
        default: return (+new Date(closeTime(a)) - +new Date(closeTime(b))) * dir;
      }
    });
  }, [all, range, status, direction, market, session, strategy, result, query, sort, asc]);

  const m = useMemo(() => summarize(filtered, snapshot.riskSettings.accountBalance), [filtered, snapshot.riskSettings.accountBalance]);
  const activeFilters = [status !== 'all', direction !== 'all', market !== 'all', session !== 'all', strategy !== 'all', result !== 'all'].filter(Boolean).length;

  const reset = () => {
    setStatus('all'); setDirection('all'); setMarket('all'); setSession('all'); setStrategy('all'); setResult('all'); setQuery('');
  };

  const handleDelete = async () => {
    if (!confirmId) return;
    await deleteTrade(confirmId);
    toast.success('Trade deleted', 'The record and its analytics impact were removed.');
    setConfirmId(null);
  };

  const handleDuplicate = async (id: string) => {
    const copy = await duplicateTrade(id);
    if (copy) {
      toast.success('Trade duplicated', 'A new open trade was created — review the entry before saving.');
      navigate(`/journal/${copy.id}/edit`);
    }
  };

  return (
    <div>
      <PageHeader
        title="Trade Journal"
        subtitle={`${all.length} recorded trades · ${m.closedTrades} closed in range · net ${m.netPnl >= 0 ? '+' : ''}${m.netPnl.toFixed(2)} ${currency}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => exportTradesCsv(filtered, `segawa-journal-${new Date().toISOString().slice(0, 10)}.csv`)} icon={<Download className="h-4 w-4" />}>CSV</Button>
            <Link to="/journal/new" className="btn-primary !py-2 text-xs"><Plus className="h-4 w-4" /> Add trade</Link>
          </div>
        }
      />

      {!all.length ? (
        <EmptyState
          illustration={<Mascot size="lg" />}
          title="Your journal is empty"
          description="Log trades manually — Segawa does not need broker connectivity. Every closed trade feeds the analytics engine and the AI coach."
          action={<Link to="/journal/new" className="btn-primary"><Plus className="h-4 w-4" /> Log your first trade</Link>}
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search instrument, setup, notes…" className="pl-9" />
            </div>
            <RangeFilter preset={preset} setPreset={setPreset} custom={custom} setCustom={setCustom} />
            <Button variant="secondary" size="sm" onClick={() => setShowFilters((v) => !v)} icon={<SlidersHorizontal className="h-4 w-4" />}>
              Filters {activeFilters > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-[#17091f]">{activeFilters}</span>}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setAsc(!asc); }} icon={<ArrowDownUp className="h-4 w-4" />}>{asc ? 'Asc' : 'Desc'}</Button>
          </div>

          {showFilters && (
            <div className="mb-3 card">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
                  <option value="all">All statuses</option><option value="open">Open</option><option value="closed">Closed</option>
                </Select>
                <Select value={direction} onChange={(e) => setDirection(e.target.value as typeof direction)} aria-label="Direction">
                  <option value="all">Buy &amp; sell</option><option value="buy">Buy only</option><option value="sell">Sell only</option>
                </Select>
                <Select value={market} onChange={(e) => setMarket(e.target.value as typeof market)} aria-label="Market">
                  <option value="all">All markets</option>
                  {MARKETS.map((mk) => <option key={mk.value} value={mk.value}>{mk.label}</option>)}
                </Select>
                <Select value={session} onChange={(e) => setSession(e.target.value)} aria-label="Session">
                  <option value="all">All sessions</option>
                  {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
                <Select value={strategy} onChange={(e) => setStrategy(e.target.value)} aria-label="Strategy">
                  <option value="all">All strategies</option>
                  {[...new Set([...STRATEGY_PRESETS, ...strategies])].map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
                <Select value={result} onChange={(e) => setResult(e.target.value as typeof result)} aria-label="Result">
                  <option value="all">Any result</option><option value="win">Winners</option><option value="loss">Losers</option><option value="be">Break-even</option>
                </Select>
                <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort by">
                  <option value="date">Sort: date</option><option value="pnl">Sort: net P&amp;L</option><option value="r">Sort: R-multiple</option>
                  <option value="risk">Sort: risk %</option><option value="instrument">Sort: instrument</option>
                </Select>
                <Button variant="secondary" onClick={reset} icon={<X className="h-4 w-4" />}>Reset filters</Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {instruments.map((i) => (
                  <button key={i} onClick={() => setQuery(i === query ? '' : i)} className={clsx('chip', query === i ? 'border-primary/60 bg-primary/20 text-primary-neon' : 'border-line bg-elevated/50 text-ink-muted')}>
                    {i}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card !p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 px-4 py-3">
              <p className="text-xs text-ink-muted">
                <Filter className="mr-1 inline h-3.5 w-3.5" />
                {filtered.length} of {all.length} trades · net{' '}
                <span className={m.netPnl >= 0 ? 'text-profit' : 'text-loss'}>{m.netPnl.toFixed(2)}</span> · win rate {m.winRate}%
              </p>
              <p className="text-[11px] text-ink-muted">Tap a row to inspect &amp; investigate</p>
            </div>
            <div className="table-wrap">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line/60">
                    <th className="th">Closed</th><th className="th">Instrument</th><th className="th">Dir</th>
                    <th className="th hidden sm:table-cell">Session</th><th className="th hidden md:table-cell">Strategy</th>
                    <th className="th text-right">Lots</th><th className="th text-right hidden sm:table-cell">Risk</th>
                    <th className="th text-right">Net P&amp;L</th><th className="th text-right">R</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const p = netPnl(t);
                    return (
                      <tr key={t.id} className="group cursor-pointer border-b border-line/30 last:border-0 hover:bg-elevated/40" onClick={() => navigate(`/journal/${t.id}`)}>
                        <td className="td text-ink-muted">{fmtDateTime(closeTime(t))}</td>
                        <td className="td font-medium">
                          <div className="flex items-center gap-1.5">
                            {t.instrument}
                            {t.status === 'open' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sakura" />}
                          </div>
                        </td>
                        <td className="td"><Badge tone={t.direction === 'buy' ? 'profit' : 'loss'}>{t.direction.toUpperCase()}</Badge></td>
                        <td className="td hidden text-ink-muted sm:table-cell">{t.session}</td>
                        <td className="td hidden max-w-[140px] truncate text-ink-muted md:table-cell">{t.strategy || '—'}</td>
                        <td className="td text-right tabular-nums">{t.lotSize}</td>
                        <td className={clsx('td hidden text-right tabular-nums sm:table-cell', t.riskPercent > snapshot.riskSettings.maxRiskPerTrade && 'text-loss')}>{t.riskPercent}%</td>
                        <td className="td text-right">{t.status === 'closed' ? <Money value={p} currency={currency} /> : <span className="text-ink-muted">open</span>}</td>
                        <td className="td text-right tabular-nums text-ink-muted">{t.status === 'closed' ? fmtR(rMultiple(t)) : '—'}</td>
                        <td className="td text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                            <button onClick={() => void handleDuplicate(t.id)} aria-label="Duplicate trade" className="rounded-lg p-1.5 text-ink-muted hover:bg-elevated hover:text-primary-neon"><Copy className="h-3.5 w-3.5" /></button>
                            <button onClick={() => setConfirmId(t.id)} aria-label="Delete trade" className="rounded-lg p-1.5 text-ink-muted hover:bg-loss/15 hover:text-loss"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!filtered.length && (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-ink-muted">No trades match these filters. <button onClick={reset} className="text-primary-neon underline">Reset</button></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Filtered net P&L', value: `${m.netPnl >= 0 ? '+' : ''}${round2(m.netPnl).toFixed(2)}`, tone: m.netPnl >= 0 ? 'text-profit' : 'text-loss' },
              { label: 'Win rate', value: `${m.winRate}%`, tone: 'text-ink' },
              { label: 'Avg R', value: `${m.avgR.toFixed(2)}R`, tone: 'text-ink' },
              { label: 'Expectancy', value: `${m.expectancy.toFixed(2)}`, tone: m.expectancy >= 0 ? 'text-profit' : 'text-loss' },
            ].map((s) => (
              <div key={s.label} className="card !p-3">
                <p className="text-[10px] uppercase tracking-wider text-ink-muted">{s.label}</p>
                <p className={clsx('mt-1 font-display text-lg font-semibold tabular-nums', s.tone)}>{s.value}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirmId)}
        title="Delete this trade?"
        message="This permanently removes the trade, its screenshots and its contribution to your analytics. This cannot be undone."
        confirmLabel="Delete trade"
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}

export type { Trade };
