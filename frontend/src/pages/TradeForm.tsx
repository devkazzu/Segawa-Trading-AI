import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Calculator, Check, ImagePlus, Save, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '../context/AppContext';
import { Crumb, PageHeader } from '../components/layout/AppShell';
import { Button, Field, Input, Select, Textarea } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { fmtMoney, fmtR, grossPnl, netPnl, plannedRr, riskAmount, rMultiple, totalCosts } from '../lib/calc';
import { uid } from '../lib/db';
import { DEFAULT_RULES, EMOTIONS, INSTRUMENTS, MARKETS, SESSIONS, TIMEFRAMES, deriveSession, findInstrument } from '../lib/instruments';
import type { Direction, Market, Screenshot, Trade } from '../lib/types';

const num = (v: string): number => (v.trim() === '' ? NaN : Number(v));
const optionalNum = (v: string): number | null => (v.trim() === '' || !isFinite(Number(v)) ? null : Number(v));
const pad = (n: number) => `${n}`.padStart(2, '0');
const toInput = (iso: string | null): string => {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);

function blankTrade(defaultInstrument: string): Trade {
  const spec = findInstrument(defaultInstrument) ?? INSTRUMENTS[0];
  return {
    id: uid(), userId: '', accountId: 'main',
    instrument: spec.symbol, market: spec.market, direction: 'buy',
    entryPrice: NaN, exitPrice: null, stopLoss: null, takeProfit: null,
    lotSize: 0.1, quantity: 0.1, contractSize: spec.contractSize, tickSize: spec.tickSize, tickValue: spec.tickValue,
    currency: spec.quoteCurrency, entryTime: new Date().toISOString(), exitTime: null,
    session: 'London', timeframe: 'M15', strategy: '', setup: '',
    riskPercent: 1, commission: 0, swap: 0, spread: 0, fees: 0,
    status: 'open', screenshots: [], notes: '', emotions: [], ruleChecklist: {},
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

export default function TradeForm() {
  const { id } = useParams<{ id: string }>();
  const { snapshot, saveTrade } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const existing = snapshot.trades.find((t) => t.id === id);
  const [trade, setTrade] = useState<Trade>(() => existing ?? blankTrade(snapshot.preferences.defaultInstrument));
  const [entryTime, setEntryTime] = useState(() => toInput(existing?.entryTime ?? new Date().toISOString()));
  const [exitTime, setExitTime] = useState(() => toInput(existing?.exitTime ?? null));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEdit && !existing) {
      toast.error('Trade not found', 'Returning to the journal.');
      navigate('/journal');
    }
  }, [isEdit, existing, navigate, toast]);

  const set = <K extends keyof Trade>(key: K, value: Trade[K]) => setTrade((t) => ({ ...t, [key]: value }));

  useEffect(() => {
    // Session follows the entry timestamp unless the trader overrides it.
    setTrade((t) => ({ ...t, session: deriveSession(new Date(entryTime).toISOString()) }));
  }, [entryTime]);

  const applyInstrument = (symbol: string) => {
    const spec = findInstrument(symbol);
    setTrade((t) => ({
      ...t,
      instrument: symbol.toUpperCase(),
      market: spec?.market ?? t.market,
      contractSize: spec?.contractSize ?? t.contractSize,
      tickSize: spec?.tickSize ?? t.tickSize,
      tickValue: spec?.tickValue ?? t.tickValue,
      currency: spec?.quoteCurrency ?? t.currency,
    }));
  };

  const computed = useMemo(() => {
    const safe: Trade = { ...trade, entryPrice: isFinite(trade.entryPrice) ? trade.entryPrice : 0 };
    const closed = safe.status === 'closed' && safe.exitPrice != null;
    const gross = closed ? grossPnl(safe) : 0;
    const net = closed ? netPnl(safe) : 0;
    const risk = riskAmount(safe);
    const rr = plannedRr(safe);
    const r = closed ? rMultiple(safe) : null;
    const plannedRiskPercent = snapshot.riskSettings.accountBalance > 0 ? (risk / snapshot.riskSettings.accountBalance) * 100 : 0;
    return { gross, net, risk, rr, r, plannedRiskPercent, costs: totalCosts(safe) };
  }, [trade, snapshot.riskSettings.accountBalance]);

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (trade.stopLoss == null) w.push('No stop loss recorded — risk cannot be verified and this will be flagged in your audit.');
    if (trade.riskPercent > snapshot.riskSettings.maxRiskPerTrade) w.push(`Risk ${trade.riskPercent}% is above your ${snapshot.riskSettings.maxRiskPerTrade}% cap.`);
    if (computed.rr != null && computed.rr < 1.5) w.push(`Planned R:R is ${computed.rr.toFixed(2)} — below the 1.5R minimum.`);
    if (!trade.strategy) w.push('No strategy attached — this trade cannot be attributed to a model.');
    if (trade.status === 'closed' && trade.exitPrice == null) w.push('Closed trade needs an exit price to compute P&L.');
    return w;
  }, [trade, computed.rr, snapshot.riskSettings.maxRiskPerTrade]);

  const onFile = async (files: FileList | null) => {
    if (!files?.length) return;
    const list: Screenshot[] = [];
    for (const file of Array.from(files).slice(0, 3)) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 8 * 1024 * 1024) { toast.error('Image too large', `${file.name} exceeds 8 MB.`); continue; }
      list.push({ id: uid(), name: file.name, url: await compressImage(file), createdAt: new Date().toISOString() });
    }
    if (list.length) {
      set('screenshots', [...trade.screenshots, ...list]);
      toast.success(`${list.length} screenshot(s) attached`);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async () => {
    setError('');
    if (!trade.instrument.trim()) { setError('Instrument is required.'); return; }
    if (!isFinite(trade.entryPrice) || trade.entryPrice <= 0) { setError('A valid entry price is required.'); return; }
    if (trade.status === 'closed' && trade.exitPrice == null) { setError('Closed trades require an exit price.'); return; }
    if (!(trade.lotSize > 0)) { setError('Lot size must be greater than zero.'); return; }
    if (!(trade.tickSize > 0) || !(trade.tickValue > 0)) { setError('Tick size and tick value must be greater than zero.'); return; }

    const payload: Trade = {
      ...trade,
      instrument: trade.instrument.toUpperCase().trim(),
      quantity: trade.lotSize,
      entryTime: new Date(entryTime).toISOString(),
      exitTime: trade.status === 'closed' ? (fromInput(exitTime) ?? new Date().toISOString()) : null,
      exitPrice: trade.status === 'closed' ? trade.exitPrice : null,
    };
    setBusy(true);
    try {
      await saveTrade(payload, !isEdit);
      toast.success(isEdit ? 'Trade updated' : 'Trade logged', `${payload.instrument} ${payload.direction.toUpperCase()} saved.`);
      navigate(`/journal/${payload.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the trade.');
    } finally {
      setBusy(false);
    }
  };

  const toggleRule = (rule: string) => {
    const rules = { ...trade.ruleChecklist };
    if (rule in rules) delete rules[rule];
    else rules[rule] = true;
    set('ruleChecklist', rules);
  };
  const setRule = (rule: string, value: boolean) => set('ruleChecklist', { ...trade.ruleChecklist, [rule]: value });

  return (
    <div className="pb-28">
      <Crumb items={[{ label: 'Journal', to: '/journal' }, { label: isEdit ? 'Edit trade' : 'New trade' }]} />
      <PageHeader
        title={isEdit ? 'Edit trade' : 'Log a trade'}
        subtitle="All figures are computed live from your broker contract specification — no estimates."
        actions={<Link to="/journal" className="btn-secondary !py-2 text-xs">Cancel</Link>}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_330px]">
        <div className="space-y-4">
          <section className="card">
            <h3 className="mb-3 text-sm font-semibold">1 · Instrument &amp; direction</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Instrument" hint="Preset or any symbol">
                <Input list="instrument-list" value={trade.instrument} onChange={(e) => applyInstrument(e.target.value)} placeholder="XAUUSD" required />
                <datalist id="instrument-list">{INSTRUMENTS.map((i) => <option key={i.symbol} value={i.symbol}>{i.name}</option>)}</datalist>
              </Field>
              <Field label="Market">
                <Select value={trade.market} onChange={(e) => set('market', e.target.value as Market)}>
                  {MARKETS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              </Field>
              <Field label="Direction">
                <div className="grid grid-cols-2 gap-1.5">
                  {(['buy', 'sell'] as Direction[]).map((d) => (
                    <button key={d} type="button" onClick={() => set('direction', d)}
                      className={clsx('rounded-xl border py-2.5 text-xs font-bold uppercase transition-all',
                        trade.direction === d
                          ? d === 'buy' ? 'border-profit/60 bg-profit/15 text-profit shadow-glow-sm' : 'border-loss/60 bg-loss/15 text-loss'
                          : 'border-line bg-bg-alt text-ink-muted hover:border-primary/40')}>
                      {d}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Status">
                <Select value={trade.status} onChange={(e) => {
                  const status = e.target.value as Trade['status'];
                  setTrade((t) => ({ ...t, status, exitPrice: status === 'open' ? null : t.exitPrice }));
                }}>
                  <option value="open">Open</option><option value="closed">Closed</option>
                </Select>
              </Field>
            </div>
          </section>

          <section className="card">
            <h3 className="mb-3 text-sm font-semibold">2 · Prices &amp; size</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Entry price">
                <Input type="number" step="0.00001" value={Number.isFinite(trade.entryPrice) ? trade.entryPrice : ''} onChange={(e) => set('entryPrice', num(e.target.value))} placeholder="2380.50" required />
              </Field>
              <Field label={trade.status === 'closed' ? 'Exit price' : 'Exit price (optional)'}>
                <Input type="number" step="0.00001" value={trade.exitPrice ?? ''} onChange={(e) => set('exitPrice', optionalNum(e.target.value))} placeholder="2384.20" />
              </Field>
              <Field label="Stop loss" hint="Required for risk &amp; R-multiple">
                <Input type="number" step="0.00001" value={trade.stopLoss ?? ''} onChange={(e) => set('stopLoss', optionalNum(e.target.value))} placeholder="2376.00" />
              </Field>
              <Field label="Take profit">
                <Input type="number" step="0.00001" value={trade.takeProfit ?? ''} onChange={(e) => set('takeProfit', optionalNum(e.target.value))} placeholder="2390.00" />
              </Field>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Lot size" hint="0.01 = micro lot"><Input type="number" step="0.01" min="0" value={Number.isFinite(trade.lotSize) ? trade.lotSize : ''} onChange={(e) => set('lotSize', num(e.target.value))} required /></Field>
              <Field label="Contract size" hint="XAUUSD = 100 oz"><Input type="number" step="0.01" value={trade.contractSize} onChange={(e) => set('contractSize', num(e.target.value))} /></Field>
              <Field label="Tick size"><Input type="number" step="0.00001" value={trade.tickSize} onChange={(e) => set('tickSize', num(e.target.value))} /></Field>
              <Field label="Tick value" hint="Per tick, per lot"><Input type="number" step="0.01" value={trade.tickValue} onChange={(e) => set('tickValue', num(e.target.value))} /></Field>
            </div>
          </section>

          <section className="card">
            <h3 className="mb-3 text-sm font-semibold">3 · Timing &amp; context</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Entry time"><Input type="datetime-local" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} required /></Field>
              <Field label="Exit time"><Input type="datetime-local" value={exitTime} onChange={(e) => setExitTime(e.target.value)} disabled={trade.status === 'open'} /></Field>
              <Field label="Session">
                <Select value={trade.session} onChange={(e) => set('session', e.target.value as Trade['session'])}>
                  {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Timeframe">
                <Select value={trade.timeframe} onChange={(e) => set('timeframe', e.target.value)}>
                  {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="Strategy">
                <Input list="strategy-list" value={trade.strategy} onChange={(e) => set('strategy', e.target.value)} placeholder="SMC" />
                <datalist id="strategy-list">
                  {[...new Set([...snapshot.strategies.map((s) => s.name), 'SMC', 'BOS', 'CHoCH', 'Order Block', 'FVG', 'Liquidity Sweep', 'Breakout', 'Retest', 'Support/Resistance', 'EMA Trend', 'Trend Following', 'Counter-Trend'])].map((s) => <option key={s} value={s} />)}
                </datalist>
              </Field>
              <Field label="Setup">
                <Input value={trade.setup} onChange={(e) => set('setup', e.target.value)} placeholder="London sweep of Asian high" />
              </Field>
            </div>
          </section>

          <section className="card">
            <h3 className="mb-3 text-sm font-semibold">4 · Risk &amp; costs</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Risk %"><Input type="number" step="0.01" min="0" value={trade.riskPercent} onChange={(e) => set('riskPercent', num(e.target.value))} /></Field>
              <Field label="Commission"><Input type="number" step="0.01" value={trade.commission} onChange={(e) => set('commission', num(e.target.value))} /></Field>
              <Field label="Swap"><Input type="number" step="0.01" value={trade.swap} onChange={(e) => set('swap', num(e.target.value))} /></Field>
              <Field label="Spread cost"><Input type="number" step="0.01" value={trade.spread} onChange={(e) => set('spread', num(e.target.value))} /></Field>
              <Field label="Other fees"><Input type="number" step="0.01" value={trade.fees} onChange={(e) => set('fees', num(e.target.value))} /></Field>
            </div>
          </section>

          <section className="card">
            <h3 className="mb-3 text-sm font-semibold">5 · Rules, emotions &amp; evidence</h3>
            <p className="label">Rule checklist</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {DEFAULT_RULES.map((rule) => {
                const value = trade.ruleChecklist[rule];
                const state = value === undefined ? 'unset' : value ? 'pass' : 'fail';
                return (
                  <div key={rule} className="flex items-center gap-1 rounded-xl border border-line/60 bg-bg-alt/50 p-1">
                    <button type="button" onClick={() => { setRule(rule, true); }}
                      className={clsx('flex flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors', state === 'pass' ? 'bg-profit/15 text-profit' : 'text-ink-muted hover:text-ink')}>
                      <Check className="h-3.5 w-3.5 shrink-0" /> {rule}
                    </button>
                    <button type="button" aria-label={`Mark ${rule} failed`} onClick={() => { setRule(rule, false); }}
                      className={clsx('rounded-lg p-1.5', state === 'fail' ? 'bg-loss/15 text-loss' : 'text-ink-muted/50 hover:text-loss')}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={() => DEFAULT_RULES.forEach(toggleRule)} className="mt-1.5 text-[10px] text-ink-muted underline">toggle unset ↔ pass</button>

            <p className="label mt-4">Emotional state</p>
            <div className="flex flex-wrap gap-1.5">
              {EMOTIONS.map((e) => {
                const active = trade.emotions.includes(e);
                return (
                  <button key={e} type="button"
                    onClick={() => set('emotions', active ? trade.emotions.filter((x) => x !== e) : [...trade.emotions, e])}
                    className={clsx('chip transition-colors', active ? (['Fear', 'Greed', 'FOMO', 'Revenge', 'Stress', 'Overconfidence', 'Impatience', 'Hesitation'].includes(e) ? 'border-loss/50 bg-loss/15 text-loss' : 'border-profit/50 bg-profit/15 text-profit') : 'border-line bg-elevated/50 text-ink-muted')}>
                    {e}
                  </button>
                );
              })}
            </div>

            <Field label="Notes" className="mt-4" hint="Thesis, invalidation and what actually happened.">
              <Textarea value={trade.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Entered on the retest of the H4 order block after the London sweep…" />
            </Field>

            <p className="label mt-4">Screenshots</p>
            <div className="flex flex-wrap gap-2">
              {trade.screenshots.map((s) => (
                <div key={s.id} className="group relative h-20 w-28 overflow-hidden rounded-xl border border-line">
                  <img src={s.url} alt={s.name} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => set('screenshots', trade.screenshots.filter((x) => x.id !== s.id))}
                    aria-label={`Remove ${s.name}`} className="absolute right-1 top-1 rounded-md bg-black/70 p-0.5 text-loss opacity-0 transition-opacity group-hover:opacity-100">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => fileRef.current?.click()}
                className="grid h-20 w-28 place-items-center rounded-xl border border-dashed border-line text-ink-muted transition-colors hover:border-primary/60 hover:text-primary-neon">
                <span className="flex flex-col items-center gap-1 text-[10px]"><ImagePlus className="h-5 w-5" /> Add image</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onFile(e.target.files)} />
            </div>
            <p className="mt-1 text-[10px] text-ink-muted/70">Images are compressed to ~1400px and stored with the trade (local browser in demo mode, Supabase Storage in production).</p>
          </section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <div className="card">
            <div className="flex items-center gap-2"><Calculator className="h-4 w-4 text-primary-neon" /><h3 className="text-sm font-semibold">Live calculation</h3></div>
            <dl className="mt-3 space-y-2 text-xs">
              <Row label="Gross P&L" value={fmtMoney(computed.gross)} tone={computed.gross} />
              <Row label="Costs" value={`−${fmtMoney(computed.costs)}`} />
              <Row label="Net P&L" value={fmtMoney(computed.net)} tone={computed.net} strong />
              <Row label="Risk at stop" value={computed.risk ? fmtMoney(computed.risk) : 'no stop'} />
              <Row label="Risk % of account" value={`${computed.plannedRiskPercent.toFixed(2)}%`} tone={computed.plannedRiskPercent > snapshot.riskSettings.maxRiskPerTrade ? -1 : 1} />
              <Row label="Planned R:R" value={computed.rr != null ? `${computed.rr.toFixed(2)} : 1` : '—'} />
              <Row label="Realised R" value={fmtR(computed.r)} strong />
            </dl>
            <div className="mt-3 rounded-xl border border-line/60 bg-bg-alt/60 p-2.5 text-[10px] leading-relaxed text-ink-muted">
              P&amp;L = <strong className="text-ink">(exit − entry) ÷ tick size × tick value × lots</strong>, signed by direction.
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="card border-sakura/30 bg-sakura/5">
              <div className="flex items-center gap-2 text-sakura"><AlertTriangle className="h-4 w-4" /><p className="text-xs font-semibold">Before you save</p></div>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-ink-muted">
                {warnings.map((w) => <li key={w}>• {w}</li>)}
              </ul>
            </div>
          )}

          {error && <div className="rounded-xl border border-loss/40 bg-loss/10 p-3 text-xs text-loss">{error}</div>}

          <Button onClick={() => void submit()} loading={busy} className="hidden w-full lg:flex" icon={<Save className="h-4 w-4" />}>
            {isEdit ? 'Save changes' : 'Save trade'}
          </Button>
        </aside>
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-14 z-20 border-t border-line/70 bg-bg/95 p-3 backdrop-blur-xl lg:hidden">
        <Button onClick={() => void submit()} loading={busy} className="w-full" icon={<Save className="h-4 w-4" />}>
          {isEdit ? 'Save changes' : 'Save trade'}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, tone, strong }: { label: string; value: string; tone?: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line/30 pb-1.5 last:border-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={clsx('tabular-nums', strong && 'font-semibold', tone != null && tone !== 0 ? (tone > 0 ? 'text-profit' : 'text-loss') : 'text-ink')}>{value}</dd>
    </div>
  );
}

async function compressImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.readAsDataURL(file);
  });
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('bad image'));
      image.src = dataUrl;
    });
    const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return dataUrl;
  }
}
