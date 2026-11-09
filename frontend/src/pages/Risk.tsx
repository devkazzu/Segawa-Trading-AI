import { useMemo, useState } from 'react';
import { AlertTriangle, Calculator, CheckCircle2, Save, Shield, ShieldAlert } from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/layout/AppShell';
import { Badge, Button, Field, Input, Metric, ProgressBar, SectionTitle, Select } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { fmtMoney, summarize } from '../lib/calc';
import { INSTRUMENTS, findInstrument } from '../lib/instruments';
import { DEFAULT_RISK_SETTINGS, accountRiskState, positionSize } from '../lib/risk';
import type { RiskSettings } from '../lib/types';

export default function Risk() {
  const { snapshot, saveRiskSettings } = useApp();
  const toast = useToast();
  const currency = snapshot.preferences.currency;
  const live = accountRiskState(snapshot.trades, snapshot.riskSettings, snapshot.riskSettings.accountBalance + summarize(snapshot.trades, snapshot.riskSettings.accountBalance).netPnl);

  const [draft, setDraft] = useState<RiskSettings>(snapshot.riskSettings);
  const [dirty, setDirty] = useState(false);
  const set = <K extends keyof RiskSettings>(k: K, v: RiskSettings[K]) => { setDraft((d) => ({ ...d, [k]: v })); setDirty(true); };

  /* ------------------------- position sizing ------------------------- */
  const [symbol, setSymbol] = useState(snapshot.preferences.defaultInstrument || 'XAUUSD');
  const [balance, setBalance] = useState(snapshot.riskSettings.accountBalance);
  const [riskMode, setRiskMode] = useState<'percent' | 'fixed'>(snapshot.riskSettings.riskPerTradeMode);
  const [riskValue, setRiskValue] = useState(snapshot.riskSettings.maxRiskPerTrade);
  const [fixedRisk, setFixedRisk] = useState(snapshot.riskSettings.fixedRiskAmount);
  const [entry, setEntry] = useState<number | ''>('');
  const [stop, setStop] = useState<number | ''>('');
  const [target, setTarget] = useState<number | ''>('');
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy');

  const spec = findInstrument(symbol) ?? INSTRUMENTS[0];
  const calc = useMemo(() => {
    if (entry === '' || stop === '' || Number(entry) === Number(stop)) return null;
    return positionSize({
      balance, riskPercent: riskValue, riskMode, fixedRisk,
      entry: Number(entry), stopLoss: Number(stop),
      tickSize: spec.tickSize, tickValue: spec.tickValue, contractSize: spec.contractSize,
    });
  }, [entry, stop, balance, riskValue, riskMode, fixedRisk, spec]);

  const rr = useMemo(() => {
    if (entry === '' || stop === '' || target === '') return null;
    const risk = Math.abs(Number(entry) - Number(stop));
    const reward = Math.abs(Number(target) - Number(entry));
    if (risk <= 0) return null;
    const validDirection = direction === 'buy' ? Number(target) > Number(entry) && Number(stop) < Number(entry) : Number(target) < Number(entry) && Number(stop) > Number(entry);
    return { ratio: reward / risk, validDirection, reward, risk };
  }, [entry, stop, target, direction]);

  const saveSettings = async () => {
    if (draft.dailyLossLimit <= 0 || draft.weeklyLossLimit <= 0) { toast.error('Limits must be positive', 'Set realistic daily and weekly loss limits.'); return; }
    await saveRiskSettings(draft);
    setDirty(false);
    toast.success('Risk settings saved', 'The guard now uses these limits on every page.');
  };

  const applyBalance = async () => {
    const next = { ...snapshot.riskSettings, accountBalance: balance };
    setDraft(next);
    await saveRiskSettings(next);
    toast.success('Balance updated', 'All analytics now measure from this starting balance.');
  };

  return (
    <div>
      <PageHeader
        title="Risk Management"
        subtitle="Position sizing, loss limits and drawdown guards computed with real broker contract specs."
        actions={<Badge tone={live.breaches.length ? 'loss' : live.warnings.length ? 'warning' : 'profit'}>{live.breaches.length ? 'BREACH' : live.warnings.length ? 'WATCH' : 'HEALTHY'}</Badge>}
      />

      {/* live state */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Equity" value={fmtMoney(live.equity, currency)} />
        <Metric label="Daily loss" value={fmtMoney(live.dailyLoss, currency)} tone="loss" hint={`limit ${fmtMoney(snapshot.riskSettings.dailyLossLimit, currency)}`} />
        <Metric label="Weekly loss" value={fmtMoney(live.weeklyLoss, currency)} tone="loss" hint={`limit ${fmtMoney(snapshot.riskSettings.weeklyLossLimit, currency)}`} />
        <Metric label="Drawdown" value={`${live.drawdownPct}%`} tone="loss" hint={`max ${snapshot.riskSettings.maxDrawdown}%`} />
        <Metric label="Trades today" value={live.tradesToday} hint={`limit ${snapshot.riskSettings.dailyTradeLimit}`} />
        <Metric label="Loss streak" value={live.consecutiveLosses} tone={live.consecutiveLosses >= snapshot.riskSettings.consecutiveLossAlert ? 'loss' : 'neutral'} />
      </div>

      {(live.breaches.length > 0 || live.warnings.length > 0) && (
        <div className={clsx('mb-4 rounded-2xl border p-3.5', live.breaches.length ? 'border-loss/40 bg-loss/10' : 'border-sakura/40 bg-sakura/10')}>
          <div className="flex items-start gap-2">
            {live.breaches.length ? <ShieldAlert className="mt-0.5 h-5 w-5 text-loss" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-sakura" />}
            <div>
              <p className={clsx('text-sm font-semibold', live.breaches.length ? 'text-loss' : 'text-sakura')}>
                {live.breaches.length ? 'Limit breached — stop trading and review' : 'Approaching a risk limit'}
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-ink/90">
                {[...live.breaches, ...live.warnings].map((b) => <li key={b}>• {b}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {/* calculator */}
        <div className="card">
          <SectionTitle title="Position size & risk calculator" subtitle="Derive lots from the stop distance — never guess size" icon={<Calculator className="h-4 w-4" />} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Instrument">
              <Select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                {INSTRUMENTS.map((i) => <option key={i.symbol} value={i.symbol}>{i.symbol} — {i.name}</option>)}
              </Select>
            </Field>
            <Field label="Direction">
              <Select value={direction} onChange={(e) => setDirection(e.target.value as 'buy' | 'sell')}>
                <option value="buy">Buy / Long</option><option value="sell">Sell / Short</option>
              </Select>
            </Field>
            <Field label="Account balance"><Input type="number" step="0.01" value={balance} onChange={(e) => setBalance(Number(e.target.value))} /></Field>
            <Field label="Risk mode">
              <Select value={riskMode} onChange={(e) => setRiskMode(e.target.value as 'percent' | 'fixed')}>
                <option value="percent">Percent of balance</option><option value="fixed">Fixed amount</option>
              </Select>
            </Field>
            {riskMode === 'percent'
              ? <Field label="Risk %"><Input type="number" step="0.01" value={riskValue} onChange={(e) => setRiskValue(Number(e.target.value))} /></Field>
              : <Field label="Risk amount"><Input type="number" step="0.01" value={fixedRisk} onChange={(e) => setFixedRisk(Number(e.target.value))} /></Field>}
            <Field label="Entry price"><Input type="number" step="0.00001" value={entry} onChange={(e) => setEntry(e.target.value === '' ? '' : Number(e.target.value))} placeholder="2380.50" /></Field>
            <Field label="Stop loss"><Input type="number" step="0.00001" value={stop} onChange={(e) => setStop(e.target.value === '' ? '' : Number(e.target.value))} placeholder="2376.00" /></Field>
            <Field label="Take profit (optional)"><Input type="number" step="0.00001" value={target} onChange={(e) => setTarget(e.target.value === '' ? '' : Number(e.target.value))} placeholder="2390.00" /></Field>
          </div>

          <div className="mt-3 rounded-xl border border-line/60 bg-bg-alt/60 p-3">
            {calc?.valid ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="Position size" value={`${calc.lots.toFixed(2)} lots`} tone="profit" />
                <Metric label="Units" value={calc.units.toFixed(0)} hint={`${spec.contractSize}/lot`} />
                <Metric label="Risk amount" value={fmtMoney(calc.riskMoney, currency)} />
                <Metric label="Stop distance" value={`${calc.stopDistance}`} hint={`${calc.stopTicks} ticks`} />
              </div>
            ) : (
              <p className="text-xs text-ink-muted">{calc?.message ?? 'Enter an entry price and a different stop loss to size the position.'}</p>
            )}
            {rr && (
              <div className={clsx('mt-2 rounded-lg border px-2.5 py-2 text-[11px]', rr.validDirection ? 'border-profit/30 bg-profit/10 text-profit' : 'border-loss/40 bg-loss/10 text-loss')}>
                Reward-to-risk: <strong>{rr.ratio.toFixed(2)} : 1</strong> · reward {rr.reward.toFixed(5)} / risk {rr.risk.toFixed(5)}
                {!rr.validDirection && ' — target is on the wrong side of entry for this direction'}
              </div>
            )}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-ink-muted">
            Contract spec used: {spec.symbol} · {spec.contractSize} units/lot · tick {spec.tickSize} · tick value {spec.tickValue} {spec.quoteCurrency}.
          </p>
          <Button className="mt-2 w-full" size="sm" variant="secondary" onClick={() => void applyBalance()} icon={<Save className="h-4 w-4" />}>Use this balance as account starting balance</Button>
        </div>

        {/* limits */}
        <div className="card">
          <SectionTitle title="Risk guard limits" subtitle="Enforced on the dashboard, journal and challenges" icon={<Shield className="h-4 w-4" />} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Max risk per trade (%)"><Input type="number" step="0.1" value={draft.maxRiskPerTrade} onChange={(e) => set('maxRiskPerTrade', Number(e.target.value))} /></Field>
            <Field label="Daily loss limit"><Input type="number" step="1" value={draft.dailyLossLimit} onChange={(e) => set('dailyLossLimit', Number(e.target.value))} /></Field>
            <Field label="Weekly loss limit"><Input type="number" step="1" value={draft.weeklyLossLimit} onChange={(e) => set('weeklyLossLimit', Number(e.target.value))} /></Field>
            <Field label="Max drawdown (%)"><Input type="number" step="0.5" value={draft.maxDrawdown} onChange={(e) => set('maxDrawdown', Number(e.target.value))} /></Field>
            <Field label="Daily trade limit"><Input type="number" step="1" value={draft.dailyTradeLimit} onChange={(e) => set('dailyTradeLimit', Number(e.target.value))} /></Field>
            <Field label="Consecutive loss alert"><Input type="number" step="1" value={draft.consecutiveLossAlert} onChange={(e) => set('consecutiveLossAlert', Number(e.target.value))} /></Field>
          </div>

          <p className="label mt-4">Default contract specification</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Contract size"><Input type="number" step="0.01" value={draft.defaultContractSize} onChange={(e) => set('defaultContractSize', Number(e.target.value))} /></Field>
            <Field label="Tick size"><Input type="number" step="0.00001" value={draft.defaultTickSize} onChange={(e) => set('defaultTickSize', Number(e.target.value))} /></Field>
            <Field label="Tick value"><Input type="number" step="0.01" value={draft.defaultTickValue} onChange={(e) => set('defaultTickValue', Number(e.target.value))} /></Field>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void saveSettings()} disabled={!dirty} icon={<Save className="h-4 w-4" />}>Save limits</Button>
            <Button size="sm" variant="secondary" onClick={() => { setDraft(DEFAULT_RISK_SETTINGS); setDirty(true); }}>Reset to defaults</Button>
            {!dirty && <span className="flex items-center gap-1 text-[11px] text-ink-muted"><CheckCircle2 className="h-3.5 w-3.5 text-profit" /> saved</span>}
          </div>

          <div className="mt-3 space-y-2">
            <ProgressBar label="Daily loss used" value={live.dailyLoss} max={draft.dailyLossLimit} tone={live.dailyLoss / Math.max(1, draft.dailyLossLimit) > 0.7 ? 'loss' : 'warning'} />
            <ProgressBar label="Weekly loss used" value={live.weeklyLoss} max={draft.weeklyLossLimit} tone="warning" />
            <ProgressBar label="Drawdown used" value={live.drawdownPct} max={draft.maxDrawdown} tone="loss" />
          </div>
        </div>
      </div>

      <div className="mt-3 card">
        <SectionTitle title="How the guard evaluates you" />
        <div className="grid gap-2 text-[11px] leading-relaxed text-ink-muted sm:grid-cols-2 lg:grid-cols-3">
          {[
            'Daily loss = absolute sum of today’s losing closed trades.',
            'Weekly loss resets every Monday using your local timezone.',
            'Drawdown is measured peak-to-trough from your starting balance.',
            'A trade is a breach when risk exceeds the per-trade cap or no stop is recorded.',
            'The consecutive-loss alert fires the moment your streak reaches the threshold.',
            'Position sizing uses (risk amount ÷ ticks at risk) ÷ tick value.',
          ].map((t) => <p key={t} className="rounded-lg border border-line/50 bg-bg-alt/40 p-2">• {t}</p>)}
        </div>
      </div>
    </div>
  );
}
