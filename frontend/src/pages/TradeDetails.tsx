import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Bot, CheckCircle2, Copy, Download, Edit3, ImageOff, MinusCircle, Sparkles, Trash2, XCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '../context/AppContext';
import { Crumb, PageHeader } from '../components/layout/AppShell';
import { Badge, Button, ConfirmDialog, Metric, SectionTitle } from '../components/ui';
import { Markdown } from '../components/Markdown';
import { Mascot } from '../components/brand';
import { useToast } from '../context/ToastContext';
import {
  fmtDateTime, fmtDuration, fmtMoney, fmtR, grossPnl, holdingMinutes, netPnl, plannedRr,
  riskAmount, rMultiple, totalCosts,
} from '../lib/calc';
import { investigateTrade, type InvestigationResult } from '../lib/analysis';
import { askAi, aiStatus } from '../lib/ai/client';
import { downloadText, tradeStatementText } from '../lib/export';

const verdictIcon = { good: CheckCircle2, warning: MinusCircle, bad: XCircle, unknown: MinusCircle };
const verdictTone = { good: 'text-profit', warning: 'text-sakura', bad: 'text-loss', unknown: 'text-ink-muted' };

export default function TradeDetails() {
  const { id } = useParams<{ id: string }>();
  const { snapshot, deleteTrade, duplicateTrade } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const trade = snapshot.trades.find((t) => t.id === id);
  const [confirm, setConfirm] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [gallery, setGallery] = useState<string | null>(null);

  const investigation: InvestigationResult | null = useMemo(
    () => (trade ? investigateTrade(trade, snapshot.trades, snapshot.riskSettings) : null),
    [trade, snapshot.trades, snapshot.riskSettings],
  );

  if (!trade) {
    return (
      <div>
        <Crumb items={[{ label: 'Journal', to: '/journal' }, { label: 'Not found' }]} />
        <div className="card text-center">
          <p className="text-sm text-ink-muted">This trade no longer exists.</p>
          <Link to="/journal" className="btn-primary mt-3 inline-flex">Back to journal</Link>
        </div>
      </div>
    );
  }

  const currency = snapshot.preferences.currency;
  const p = netPnl(trade);
  const r = rMultiple(trade);
  const rr = plannedRr(trade);
  const risk = riskAmount(trade);

  const runAi = async () => {
    setAiBusy(true);
    setAiText('');
    try {
      const res = await askAi({
        question: `Investigate this individual trade and answer: was the entry valid, was the setup followed, was the stop reasonable, was the target realistic, was the R:R acceptable, was the exit premature, was it emotional, has the same mistake happened before, and what could be improved?`,
        history: [],
        trades: snapshot.trades,
        settings: snapshot.riskSettings,
        cfg: {
          provider: snapshot.preferences.aiProvider,
          model: snapshot.preferences.aiModel,
          baseUrl: snapshot.preferences.aiBaseUrl,
          temperature: snapshot.preferences.aiTemperature,
        },
        mode: 'investigate',
        extra: `FOCUS TRADE JSON:\n${JSON.stringify({
          instrument: trade.instrument, direction: trade.direction, entry: trade.entryPrice, exit: trade.exitPrice,
          stop: trade.stopLoss, target: trade.takeProfit, lots: trade.lotSize, riskPercent: trade.riskPercent,
          netPnl: p, rMultiple: r, plannedRR: rr, costs: totalCosts(trade), session: trade.session,
          strategy: trade.strategy, setup: trade.setup, emotions: trade.emotions, rules: trade.ruleChecklist,
          notes: trade.notes, entryTime: trade.entryTime, exitTime: trade.exitTime,
        })}`,
      });
      setAiText(res.text);
      if (res.warning) toast.error('AI provider unavailable', res.warning);
    } catch (err) {
      toast.error('Investigation failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAiBusy(false);
    }
  };

  const status = aiStatus({
    provider: snapshot.preferences.aiProvider, model: snapshot.preferences.aiModel,
    baseUrl: snapshot.preferences.aiBaseUrl, temperature: snapshot.preferences.aiTemperature,
  });

  return (
    <div>
      <Crumb items={[{ label: 'Journal', to: '/journal' }, { label: `${trade.instrument} ${trade.direction.toUpperCase()}` }]} />
      <PageHeader
        title={`${trade.instrument} · ${trade.direction.toUpperCase()}`}
        subtitle={`${fmtDateTime(trade.entryTime)} → ${trade.exitTime ? fmtDateTime(trade.exitTime) : 'still open'}`}
        badge={trade.status === 'open' ? 'OPEN' : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => downloadText(`segawa-trade-${trade.id.slice(0, 8)}.txt`, tradeStatementText(trade))} icon={<Download className="h-4 w-4" />}>Statement</Button>
            <Button variant="secondary" size="sm" onClick={() => { void duplicateTrade(trade.id).then((c) => { if (c) { toast.success('Duplicated'); navigate(`/journal/${c.id}/edit`); } }); }} icon={<Copy className="h-4 w-4" />}>Duplicate</Button>
            <Link to={`/journal/${trade.id}/edit`} className="btn-secondary !py-2 text-xs"><Edit3 className="h-4 w-4" /> Edit</Link>
            <Button variant="danger" size="sm" onClick={() => setConfirm(true)} icon={<Trash2 className="h-4 w-4" />}>Delete</Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-muted">Net result</p>
                <p className={clsx('font-display text-3xl font-bold tabular-nums', p > 0 ? 'text-profit' : p < 0 ? 'text-loss' : 'text-ink')}>
                  {trade.status === 'closed' ? fmtMoney(p, currency) : '—'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={trade.direction === 'buy' ? 'profit' : 'loss'}>{trade.direction.toUpperCase()}</Badge>
                <Badge tone="neutral">{trade.market}</Badge>
                <Badge tone="neutral">{trade.session}</Badge>
                <Badge tone="neutral">{trade.timeframe}</Badge>
                {trade.status === 'closed' && <Badge tone={p > 0 ? 'profit' : p < 0 ? 'loss' : 'neutral'}>{fmtR(r)}</Badge>}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Entry" value={trade.entryPrice} />
              <Metric label="Exit" value={trade.exitPrice ?? '—'} />
              <Metric label="Stop loss" value={trade.stopLoss ?? 'none'} tone={trade.stopLoss == null ? 'loss' : 'neutral'} />
              <Metric label="Take profit" value={trade.takeProfit ?? '—'} />
              <Metric label="Lot size" value={trade.lotSize} />
              <Metric label="Risk" value={`${trade.riskPercent}%`} tone={trade.riskPercent > snapshot.riskSettings.maxRiskPerTrade ? 'loss' : 'neutral'} hint={risk ? fmtMoney(risk, currency) : 'unmeasurable'} />
              <Metric label="Planned R:R" value={rr != null ? `${rr.toFixed(2)}:1` : '—'} />
              <Metric label="Gross / costs" value={`${fmtMoney(grossPnl(trade), currency, 0)} / −${fmtMoney(totalCosts(trade), currency, 0)}`} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Holding time" value={fmtDuration(holdingMinutes(trade) ?? 0)} />
              <Metric label="Strategy" value={trade.strategy || '—'} />
              <Metric label="Setup" value={trade.setup || '—'} />
              <Metric label="Contract" value={`${trade.contractSize} × tick ${trade.tickValue}`} />
            </div>
          </div>

          <div className="card">
            <SectionTitle title="Notes & emotional state" subtitle="Recorded by you at execution time" />
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{trade.notes || <span className="text-ink-muted">No notes recorded for this trade.</span>}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {trade.emotions.length ? trade.emotions.map((e) => {
                const neg = ['Fear', 'Greed', 'FOMO', 'Revenge', 'Stress', 'Overconfidence', 'Impatience', 'Hesitation'].includes(e);
                return <Badge key={e} tone={neg ? 'loss' : 'profit'}>{e}</Badge>;
              }) : <span className="text-xs text-ink-muted">No emotional tags.</span>}
            </div>
            <div className="mt-4">
              <p className="label">Rule checklist</p>
              {Object.keys(trade.ruleChecklist).length ? (
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {Object.entries(trade.ruleChecklist).map(([rule, ok]) => (
                    <li key={rule} className={clsx('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px]', ok ? 'border-profit/30 bg-profit/10 text-profit' : 'border-loss/30 bg-loss/10 text-loss')}>
                      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />} {rule}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-ink-muted">No checklist completed — this trade cannot be verified against your rules.</p>}
            </div>
          </div>

          <div className="card">
            <SectionTitle title="Screenshots" subtitle={`${trade.screenshots.length} attachment(s)`} />
            {trade.screenshots.length ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {trade.screenshots.map((s) => (
                  <button key={s.id} onClick={() => setGallery(s.url)} className="overflow-hidden rounded-xl border border-line hover:border-primary/50">
                    <img src={s.url} alt={s.name} className="h-28 w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-line p-4 text-xs text-ink-muted">
                <ImageOff className="h-4 w-4" /> No chart screenshots attached. Add them when editing the trade to strengthen evidence.
              </div>
            )}
          </div>

          <div className="card">
            <SectionTitle
              title="AI trade investigation"
              subtitle={status.label}
              icon={<Bot className="h-4 w-4" />}
              action={<Button size="sm" variant="secondary" onClick={() => void runAi()} loading={aiBusy} icon={<Sparkles className="h-4 w-4" />}>Run investigation</Button>}
            />
            {investigation && (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-line bg-bg-alt/60 px-3 py-2">
                  <span className="text-xs text-ink-muted">Structured execution score</span>
                  <span className={clsx('font-display text-lg font-bold', investigation.score >= 70 ? 'text-profit' : investigation.score >= 45 ? 'text-sakura' : 'text-loss')}>{investigation.score}/100</span>
                </div>
                {investigation.items.map((item) => {
                  const Icon = verdictIcon[item.verdict];
                  return (
                    <div key={item.question} className="rounded-xl border border-line/60 bg-bg-alt/40 p-3">
                      <div className="flex items-start gap-2">
                        <Icon className={clsx('mt-0.5 h-4 w-4 shrink-0', verdictTone[item.verdict])} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold">{item.question}</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">{item.answer}</p>
                          <span className="mt-1 inline-block text-[9px] uppercase tracking-wider text-ink-muted/60">{item.verified ? 'verified from records' : 'interpretation'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {investigation.improvements.length > 0 && (
                  <div className="rounded-xl border border-primary/30 bg-primary/10 p-3">
                    <p className="text-xs font-semibold text-primary-neon">What could be improved</p>
                    <ul className="mt-1 space-y-1 text-[11px] text-ink/90">
                      {investigation.improvements.map((i) => <li key={i}>• {i}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {aiBusy && <div className="mt-3 skeleton h-24 w-full" />}
            {aiText && (
              <div className="mt-3 rounded-xl border border-sakura/30 bg-sakura/5 p-3">
                <Markdown text={aiText} />
                <p className="mt-2 text-[9px] uppercase tracking-wider text-ink-muted/60">Generated by {status.source === 'local-analysis' ? 'the local statistical engine' : 'your configured AI provider'} · not financial advice</p>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-3">
          <div className="card">
            <div className="flex items-center gap-2">
              <Mascot size="sm" />
              <div>
                <p className="text-xs font-semibold">Hiro's verdict</p>
                <p className="text-[10px] text-ink-muted">Based on recorded fields only</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-muted">
              {investigation
                ? investigation.score >= 70
                  ? 'This trade followed your recorded process. Hold the template — repeatability is the edge.'
                  : investigation.score >= 45
                    ? 'Parts of the process were skipped. The gap between plan and execution is where the money went.'
                    : 'This trade broke several of your own rules. Treat it as evidence for the next audit rather than a one-off.'
                : ''}
            </p>
            <div className="mt-3 space-y-1.5 text-[11px]">
              <p className="flex justify-between"><span className="text-ink-muted">Repeated mistakes</span><span>{investigation?.repeatedMistakes.length ?? 0}</span></p>
              <p className="flex justify-between"><span className="text-ink-muted">Signed R</span><span className="tabular-nums">{r != null ? fmtR(r) : '—'}</span></p>
              <p className="flex justify-between"><span className="text-ink-muted">Recorded</span><span>{fmtDateTime(trade.createdAt)}</span></p>
              <p className="flex justify-between"><span className="text-ink-muted">Updated</span><span>{fmtDateTime(trade.updatedAt)}</span></p>
            </div>
          </div>

          <div className="card">
            <p className="text-xs font-semibold">Price levels</p>
            <div className="mt-3 space-y-1.5">
              {[
                { label: 'Take profit', value: trade.takeProfit, color: 'bg-profit' },
                { label: 'Entry', value: trade.entryPrice, color: 'bg-primary' },
                { label: 'Exit', value: trade.exitPrice, color: 'bg-sakura' },
                { label: 'Stop loss', value: trade.stopLoss, color: 'bg-loss' },
              ].filter((x) => x.value != null).map((x) => (
                <div key={x.label} className="flex items-center gap-2">
                  <span className={clsx('h-1.5 w-1.5 rounded-full', x.color)} />
                  <span className="flex-1 text-[11px] text-ink-muted">{x.label}</span>
                  <span className="text-[11px] font-semibold tabular-nums">{x.value}</span>
                </div>
              ))}
            </div>
          </div>

          <Link to="/journal" className="btn-secondary w-full !py-2 text-xs"><ArrowLeft className="h-4 w-4" /> Back to journal</Link>
        </aside>
      </div>

      {gallery && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/90 p-4" onClick={() => setGallery(null)}>
          <img src={gallery} alt="Trade screenshot" className="max-h-[90dvh] max-w-full rounded-xl" />
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title="Delete this trade?"
        message="This removes the trade and its analytics contribution permanently."
        confirmLabel="Delete"
        danger
        onConfirm={() => { void deleteTrade(trade.id).then(() => { toast.success('Trade deleted'); navigate('/journal'); }); }}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
