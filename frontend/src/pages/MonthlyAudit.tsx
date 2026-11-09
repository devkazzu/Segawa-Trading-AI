import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertOctagon, ArrowRight, Bot, CheckCircle2, Download, FileDown, Loader2, Save, ShieldAlert, Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/layout/AppShell';
import { Badge, Button, EmptyState, Metric, SectionTitle, Select, Tabs } from '../components/ui';
import { Markdown } from '../components/Markdown';
import { Mascot } from '../components/brand';
import { useToast } from '../context/ToastContext';
import {
  closeTime, fmtDate, fmtDuration, fmtMoney, fmtR, groupPerformance, monthKey, monthlyPerformance,
  netPnl, summarize,
} from '../lib/calc';
import { uid } from '../lib/db';
import { runAudit } from '../lib/analysis';
import { askAi } from '../lib/ai/client';
import { REPORT_PROMPT } from '../lib/ai/prompt';
import { localCoachAnswer } from '../lib/ai/localCoach';
import { exportReportPdf } from '../lib/export';
import type { Finding, MonthlyReport } from '../lib/types';

const severityTone: Record<Finding['severity'], string> = {
  critical: 'border-loss/50 bg-loss/10 text-loss',
  high: 'border-sakura/50 bg-sakura/10 text-sakura',
  medium: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  low: 'border-line bg-elevated/60 text-ink-muted',
};

export default function MonthlyAudit() {
  const { snapshot, saveReport, deleteReport } = useApp();
  const toast = useToast();
  const currency = snapshot.preferences.currency;
  const settings = snapshot.riskSettings;

  const months = useMemo(() => monthlyPerformance(snapshot.trades, 24).reverse(), [snapshot.trades]);
  const [period, setPeriod] = useState<string>(months[0]?.month ?? monthKey(new Date().toISOString()));
  const [tab, setTab] = useState<'findings' | 'report' | 'saved'>('findings');
  const [narrative, setNarrative] = useState('');
  const [busy, setBusy] = useState(false);
  const [busySource, setBusySource] = useState('');

  const scoped = useMemo(() => snapshot.trades.filter((t) => monthKey(closeTime(t)) === period), [snapshot.trades, period]);
  const m = useMemo(() => summarize(scoped, settings.accountBalance), [scoped, settings.accountBalance]);
  const audit = useMemo(() => runAudit(scoped, settings), [scoped, settings]);
  const saved = snapshot.reports.filter((r) => r.period === period);
  const label = new Date(`${period}-01T00:00:00`).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  if (!snapshot.trades.length) {
    return (
      <div>
        <PageHeader title="AI Monthly Trading Intelligence" subtitle="A full audit of one month of recorded trading." />
        <EmptyState title="No history to audit" description="Record trades for a month and this module will quantify every mistake, its frequency and its cost." action={<Link to="/journal/new" className="btn-primary">Log a trade</Link>} />
      </div>
    );
  }

  const generate = async () => {
    setBusy(true);
    setBusySource('Preparing your monthly context…');
    try {
      const res = await askAi({
        question: REPORT_PROMPT(label),
        history: [],
        trades: scoped,
        settings,
        cfg: {
          provider: snapshot.preferences.aiProvider, model: snapshot.preferences.aiModel,
          baseUrl: snapshot.preferences.aiBaseUrl, temperature: snapshot.preferences.aiTemperature,
        },
        mode: 'report',
      });
      setNarrative(res.text);
      setBusySource(res.source);
      setTab('report');
      if (res.warning) toast.error('AI unavailable', 'Generated with the local statistical engine instead.');
      else toast.success('Report generated', res.source === 'local-analysis' ? 'Local statistical engine' : 'AI provider');
    } catch (err) {
      toast.error('Report failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const saveCurrent = async () => {
    if (!narrative) { toast.error('Nothing to save', 'Generate the report first.'); return; }
    const report: MonthlyReport = {
      id: uid(), period, title: `${label} trading audit`, summary: audit.findings[0]?.title ?? 'No critical pattern detected',
      metrics: {
        trades: m.closedTrades, winRate: m.winRate, netPnl: m.netPnl, profitFactor: isFinite(m.profitFactor) ? m.profitFactor : 999,
        expectancy: m.expectancy, avgR: m.avgR, maxDrawdown: m.maxDrawdown, avgHoldMinutes: m.avgHoldMinutes,
      },
      findings: audit.findings, recommendations: audit.findings.slice(0, 6).map((f) => f.correction),
      source: busySource === 'local-analysis' || !busySource ? 'local-analysis' : 'ai', createdAt: new Date().toISOString(),
    };
    await saveReport(report);
    toast.success('Report saved', 'Available in Reports and exportable as PDF.');
  };

  const handlePdf = () => {
    exportReportPdf({
      title: `${label} trading audit`,
      subtitle: `${m.closedTrades} closed trades · ${audit.findings.length} findings`,
      ownerName: snapshot.profile.fullName,
      trades: scoped, startingBalance: settings.accountBalance,
      findings: audit.findings, narrative, recommendations: audit.findings.map((f) => f.correction),
    }, `segawa-audit-${period}.pdf`);
  };

  const scores = [
    { label: 'Discipline', value: audit.disciplineScore, hint: 'checklist compliance' },
    { label: 'Risk control', value: audit.riskScore, hint: 'trades inside risk cap' },
    { label: 'Execution', value: audit.executionScore, hint: 'strategy + setup + stop' },
  ];

  return (
    <div>
      <PageHeader
        title="AI Monthly Trading Intelligence"
        subtitle="Every figure below is computed from that month's recorded trades. Interpretations are labelled."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onChange={(e) => { setPeriod(e.target.value); setNarrative(''); }} aria-label="Period" className="!w-auto !py-2 !text-xs">
              {months.map((mo) => <option key={mo.month} value={mo.month}>{mo.label}</option>)}
            </Select>
            <Button size="sm" onClick={() => void generate()} loading={busy} icon={<Sparkles className="h-4 w-4" />}>Generate audit</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Trades" value={m.closedTrades} hint={`${m.openTrades} open`} />
        <Metric label="Net P&L" value={fmtMoney(m.netPnl, currency)} tone={m.netPnl >= 0 ? 'profit' : 'loss'} />
        <Metric label="Win rate" value={`${m.winRate}%`} />
        <Metric label="Profit factor" value={m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)} />
        <Metric label="Expectancy" value={fmtMoney(m.expectancy, currency)} tone={m.expectancy >= 0 ? 'profit' : 'loss'} />
        <Metric label="Max DD" value={`${m.maxDrawdownPct.toFixed(1)}%`} tone="loss" />
        <Metric label="Gross profit" value={fmtMoney(m.grossProfit, currency)} tone="profit" />
        <Metric label="Gross loss" value={fmtMoney(m.grossLoss, currency)} tone="loss" />
        <Metric label="Average R" value={m.avgR.toFixed(2)} />
        <Metric label="Avg hold" value={fmtDuration(m.avgHoldMinutes)} />
        <Metric label="Streaks" value={`W${m.maxWinStreak}/L${m.maxLossStreak}`} />
        <Metric label="Frequency" value={`${m.avgTradesPerDay}/day`} hint={`${m.tradingDays} trading days`} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {scores.map((s) => (
          <div key={s.label} className="card">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">{s.label}</p>
              <p className={clsx('font-display text-xl font-bold', s.value >= 75 ? 'text-profit' : s.value >= 50 ? 'text-sakura' : 'text-loss')}>{s.value}%</p>
            </div>
            <p className="mt-0.5 text-[10px] text-ink-muted">{s.hint}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevated">
              <div className={clsx('h-full rounded-full', s.value >= 75 ? 'bg-profit' : s.value >= 50 ? 'bg-sakura' : 'bg-loss')} style={{ width: `${s.value}%` }} />
            </div>
          </div>
        ))}
      </div>

      <Tabs className="my-4" value={tab} onChange={setTab} tabs={[
        { value: 'findings', label: `Detected mistakes (${audit.findings.length})` },
        { value: 'report', label: 'AI report' },
        { value: 'saved', label: `Saved (${saved.length})` },
      ]} />

      {tab === 'findings' && (
        <div className="grid gap-3 lg:grid-cols-2">
          {audit.findings.map((f) => (
            <div key={f.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertOctagon className={clsx('mt-0.5 h-4 w-4 shrink-0', f.severity === 'critical' ? 'text-loss' : f.severity === 'high' ? 'text-sakura' : 'text-ink-muted')} />
                  <div>
                    <p className="text-sm font-semibold">{f.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={clsx('chip', severityTone[f.severity])}>{f.severity}</span>
                      <Badge tone={f.verified ? 'profit' : 'warning'}>{f.verified ? 'verified fact' : 'interpretation'}</Badge>
                      <span className="text-[10px] text-ink-muted">{f.frequency}×</span>
                    </div>
                  </div>
                </div>
                {f.impact !== 0 && <span className={clsx('shrink-0 font-display text-sm font-bold', f.impact >= 0 ? 'text-profit' : 'text-loss')}>{fmtMoney(f.impact, currency, 0)}</span>}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-muted"><strong className="text-ink">Evidence:</strong> {f.evidence}</p>
              {f.explanation && <p className="mt-1 text-[11px] leading-relaxed text-ink-muted"><strong className="text-ink">Why it matters:</strong> {f.explanation}</p>}
              <p className="mt-1 rounded-lg border border-primary/25 bg-primary/10 px-2 py-1.5 text-[11px] leading-relaxed text-ink/90"><strong className="text-primary-neon">Fix:</strong> {f.correction}</p>
              {f.tradeIds.length > 0 && (
                <p className="mt-2 text-[10px] text-ink-muted">
                  Affected trades: {f.tradeIds.slice(0, 4).map((id, i) => {
                    const t = scoped.find((x) => x.id === id);
                    return t ? <span key={id}>{i > 0 ? ', ' : ''}<Link to={`/journal/${id}`} className="text-primary-neon hover:underline">{t.instrument} {new Date(closeTime(t)).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</Link></span> : null;
                  })}
                  {f.tradeIds.length > 4 && ` +${f.tradeIds.length - 4} more`}
                </p>
              )}
            </div>
          ))}
          {!audit.findings.length && (
            <div className="card lg:col-span-2">
              <div className="flex items-center gap-2 text-profit"><CheckCircle2 className="h-5 w-5" /><p className="text-sm font-semibold">No mistake pattern detected in {label}</p></div>
              <p className="mt-1 text-xs text-ink-muted">That is either a genuinely clean month or incomplete logging. Complete the rule checklist and emotional tags to make the audit provable.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'report' && (
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle title={`${label} narrative audit`} subtitle={busySource ? `source: ${busySource.replace('-', ' ')}` : 'Generate to create the narrative'} icon={<Bot className="h-4 w-4" />} />
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => { setNarrative(localCoachAnswer(`Analyse my ${label} performance`, scoped, settings)); setBusySource('local-analysis'); }} icon={<ShieldAlert className="h-4 w-4" />}>Local analysis</Button>
              <Button size="sm" onClick={() => void generate()} loading={busy} icon={<Sparkles className="h-4 w-4" />}>Generate</Button>
            </div>
          </div>
          {busy && (
            <div className="flex items-center gap-2 py-10 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin text-primary-neon" /> {busySource || 'Working…'}
            </div>
          )}
          {!busy && narrative && (
            <>
              <div className="rounded-xl border border-line/60 bg-bg-alt/40 p-3">
                <Markdown text={narrative} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void saveCurrent()} icon={<Save className="h-4 w-4" />}>Save report</Button>
                <Button size="sm" variant="secondary" onClick={handlePdf} icon={<FileDown className="h-4 w-4" />}>Download PDF</Button>
              </div>
            </>
          )}
          {!busy && !narrative && (
            <div className="flex flex-col items-center py-10 text-center">
              <Mascot size="md" />
              <p className="mt-3 max-w-md text-xs leading-relaxed text-ink-muted">
                Generate the monthly audit to get a structured verdict: performance, verified strengths, verified mistakes with financial impact, psychology read, risk compliance and five corrective actions.
              </p>
            </div>
          )}
        </div>
      )}

      {tab === 'saved' && (
        <div className="space-y-3">
          {saved.map((r) => (
            <div key={r.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{r.title}</p>
                  <p className="text-[10px] text-ink-muted">{fmtDate(r.createdAt)} · source {r.source.replace('-', ' ')} · {r.findings.length} findings</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => exportReportPdf({ title: r.title, subtitle: `${r.findings.length} findings`, ownerName: snapshot.profile.fullName, trades: scoped, startingBalance: settings.accountBalance, findings: r.findings, recommendations: r.recommendations }, `segawa-${r.period}.pdf`)} icon={<Download className="h-4 w-4" />}>PDF</Button>
                  <Button size="sm" variant="danger" onClick={() => void deleteReport(r.id)}>Delete</Button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries(r.metrics).slice(0, 4).map(([k, v]) => (
                  <Metric key={k} label={k.replace(/([A-Z])/g, ' $1')} value={typeof v === 'number' ? (k.toLowerCase().includes('pnl') || k.toLowerCase().includes('drawdown') || k.toLowerCase().includes('expectancy') ? fmtMoney(v, currency) : v.toFixed(2)) : String(v)} />
                ))}
              </div>
            </div>
          ))}
          {!saved.length && <EmptyState title="No saved reports for this period" description="Generate the narrative audit and save it to keep a permanent record." />}
        </div>
      )}

      {audit.strategies.length > 0 && (
        <div className="mt-3 card">
          <SectionTitle title="Month at a glance" subtitle="Sessions and strategies in this period" action={<Link to="/analytics" className="text-xs font-semibold text-primary-neon hover:underline">Full analytics <ArrowRight className="inline h-3 w-3" /></Link>} />
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-ink-muted">Sessions</p>
              {groupPerformance(scoped, (t) => t.session).map((s) => (
                <div key={s.name} className="flex justify-between border-b border-line/30 py-1 text-[11px] last:border-0">
                  <span>{s.name}</span><span className={s.pnl >= 0 ? 'text-profit' : 'text-loss'}>{fmtMoney(s.pnl, currency, 0)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-ink-muted">Strategies</p>
              {audit.strategies.slice(0, 6).map((s) => (
                <div key={s.name} className="flex justify-between border-b border-line/30 py-1 text-[11px] last:border-0">
                  <span className="truncate">{s.name}</span><span className={s.pnl >= 0 ? 'text-profit' : 'text-loss'}>{fmtMoney(s.pnl, currency, 0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="mt-3 text-center text-[10px] text-ink-muted/70">
        Largest win {fmtMoney(m.bestTrade, currency)} · largest loss {fmtMoney(m.worstTrade, currency)} · avg R {fmtR(m.avgR)} · net on {scoped.filter((t) => t.status === 'closed').reduce((s, t) => s + netPnl(t), 0).toFixed(2)} {currency}
      </p>
    </div>
  );
}
