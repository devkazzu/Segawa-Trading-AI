import { useMemo, useState } from 'react';
import { Download, FileDown, FileText, Loader2, Printer, Save, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/layout/AppShell';
import { Badge, Button, EmptyState, Field, Input, Metric, SectionTitle, Select } from '../components/ui';
import { Markdown } from '../components/Markdown';
import { useToast } from '../context/ToastContext';
import { filterTrades, fmtDuration, fmtMoney, netPnl, rangeToDates, summarize, type RangePreset } from '../lib/calc';
import { uid } from '../lib/db';
import { runAudit } from '../lib/analysis';
import { askAi } from '../lib/ai/client';
import { localCoachAnswer } from '../lib/ai/localCoach';
import { exportReportPdf, exportTradesCsv, printCurrentView } from '../lib/export';
import type { DateRange, MonthlyReport } from '../lib/types';

const TYPES: { value: string; label: string; preset: RangePreset }[] = [
  { value: 'daily', label: 'Daily report', preset: 'today' },
  { value: 'weekly', label: 'Weekly report', preset: 'week' },
  { value: 'monthly', label: 'Monthly report', preset: 'month' },
  { value: 'quarterly', label: 'Quarterly report', preset: '3m' },
  { value: 'annual', label: 'Annual report', preset: 'year' },
  { value: 'custom', label: 'Custom range', preset: 'custom' },
];

export default function Reports() {
  const { snapshot, saveReport, deleteReport } = useApp();
  const toast = useToast();
  const currency = snapshot.preferences.currency;
  const settings = snapshot.riskSettings;

  const [type, setType] = useState('monthly');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [narrative, setNarrative] = useState('');
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState('');

  const range: DateRange = useMemo(() => {
    const t = TYPES.find((x) => x.value === type) ?? TYPES[2];
    return rangeToDates(t.preset, custom);
  }, [type, custom]);

  const scoped = useMemo(() => filterTrades(snapshot.trades, range), [snapshot.trades, range]);
  const m = useMemo(() => summarize(scoped, settings.accountBalance), [scoped, settings.accountBalance]);
  const audit = useMemo(() => runAudit(scoped, settings), [scoped, settings]);
  const label = TYPES.find((t) => t.value === type)?.label ?? 'Report';

  const generate = async (forceLocal = false) => {
    setBusy(true);
    try {
      if (forceLocal) {
        setNarrative(localCoachAnswer(`Generate my ${label}`, scoped, settings));
        setSource('local-analysis');
        toast.success('Local analysis generated');
      } else {
        const res = await askAi({
          question: `Generate a complete ${label} for the period ${range.label}. Include performance, mistakes with financial impact, strategy and session findings, psychology, risk compliance and 5 improvement recommendations.`,
          history: [], trades: scoped, settings, mode: 'report',
          cfg: {
            provider: snapshot.preferences.aiProvider, model: snapshot.preferences.aiModel,
            baseUrl: snapshot.preferences.aiBaseUrl, temperature: snapshot.preferences.aiTemperature,
          },
        });
        setNarrative(res.text);
        setSource(res.source);
        if (res.warning) toast.error('AI unavailable', 'Generated with the local statistical engine.');
        else toast.success('Report generated');
      }
    } catch (err) {
      toast.error('Report failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const pdf = (withNarrative = true) => {
    exportReportPdf({
      title: label,
      subtitle: `${range.label} · ${scoped.length} trades`,
      ownerName: snapshot.profile.fullName,
      trades: scoped,
      startingBalance: settings.accountBalance,
      findings: audit.findings,
      narrative: withNarrative ? narrative : undefined,
      recommendations: audit.findings.map((f) => f.correction),
    }, `segawa-${type}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const save = async () => {
    if (!narrative) { toast.error('Generate a report first'); return; }
    const report: MonthlyReport = {
      id: uid(), period: range.from ? range.from.slice(0, 7) : 'all', title: `${label} — ${range.label}`,
      summary: audit.findings[0]?.title ?? 'No critical pattern detected',
      metrics: {
        trades: m.closedTrades, winRate: m.winRate, netPnl: m.netPnl,
        profitFactor: isFinite(m.profitFactor) ? m.profitFactor : 999, expectancy: m.expectancy,
        avgR: m.avgR, maxDrawdown: m.maxDrawdown, avgHoldMinutes: m.avgHoldMinutes,
      },
      findings: audit.findings, recommendations: audit.findings.map((f) => f.correction),
      source: source === 'local-analysis' ? 'local-analysis' : 'ai', createdAt: new Date().toISOString(),
    };
    await saveReport(report);
    toast.success('Report saved');
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Daily, weekly, monthly, quarterly, annual or custom — exportable as PDF, CSV or print."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => pdf(true)} icon={<FileDown className="h-4 w-4" />}>PDF</Button>
            <Button size="sm" variant="secondary" onClick={() => exportTradesCsv(scoped, `segawa-${type}-trades.csv`)} icon={<Download className="h-4 w-4" />}>CSV</Button>
            <Button size="sm" variant="secondary" onClick={printCurrentView} icon={<Printer className="h-4 w-4" />}>Print</Button>
          </div>
        }
      />

      <div className="card mb-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Report type">
            <Select value={type} onChange={(e) => { setType(e.target.value); setNarrative(''); }}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          {type === 'custom' ? (
            <>
              <Field label="From"><Input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></Field>
              <Field label="To"><Input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></Field>
            </>
          ) : (
            <Field label="Period"><Input value={range.label} readOnly className="opacity-70" /></Field>
          )}
          <Field label="Trades in range"><Input value={`${scoped.length} (${scoped.filter((t) => t.status === 'closed').length} closed)`} readOnly className="opacity-70" /></Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void generate()} loading={busy} icon={<Sparkles className="h-4 w-4" />}>Generate with AI</Button>
          <Button size="sm" variant="secondary" onClick={() => void generate(true)} loading={busy} icon={<FileText className="h-4 w-4" />}>Local analysis</Button>
          <Button size="sm" variant="secondary" onClick={() => void save()} icon={<Save className="h-4 w-4" />}>Save report</Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Net P&L" value={fmtMoney(m.netPnl, currency)} tone={m.netPnl >= 0 ? 'profit' : 'loss'} />
            <Metric label="Win rate" value={`${m.winRate}%`} hint={`${m.wins}W/${m.losses}L`} />
            <Metric label="Profit factor" value={m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)} />
            <Metric label="Expectancy" value={fmtMoney(m.expectancy, currency)} tone={m.expectancy >= 0 ? 'profit' : 'loss'} />
            <Metric label="Max drawdown" value={fmtMoney(m.maxDrawdown, currency)} tone="loss" />
            <Metric label="Average R" value={m.avgR.toFixed(2)} />
            <Metric label="Avg hold" value={fmtDuration(m.avgHoldMinutes)} />
            <Metric label="Best / worst" value={`${fmtMoney(m.bestTrade, currency, 0)} / ${fmtMoney(m.worstTrade, currency, 0)}`} />
          </div>

          <div className="card">
            <SectionTitle title={`${label} narrative`} subtitle={source ? `source: ${source.replace('-', ' ')}` : 'Not generated yet'} />
            {busy && <div className="flex items-center gap-2 py-8 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin text-primary-neon" /> Composing your report…</div>}
            {!busy && narrative && <div className="rounded-xl border border-line/60 bg-bg-alt/40 p-3"><Markdown text={narrative} /></div>}
            {!busy && !narrative && (
              <p className="py-8 text-center text-xs leading-relaxed text-ink-muted">
                Generate the report to get a structured narrative. The metrics, findings and recommendations are always available without AI.
              </p>
            )}
          </div>

          <div className="card">
            <SectionTitle title="Verified findings in this period" subtitle={`${audit.findings.length} detected`} />
            <div className="space-y-1.5">
              {audit.findings.map((f) => (
                <div key={f.id} className="flex items-start justify-between gap-2 rounded-lg border border-line/50 bg-bg-alt/40 px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{f.title}</p>
                    <p className="text-[10px] text-ink-muted">{f.verified ? 'verified' : 'interpretation'} · {f.frequency}×</p>
                  </div>
                  <Badge tone={f.severity === 'critical' ? 'loss' : f.severity === 'high' ? 'warning' : 'neutral'}>{f.severity}</Badge>
                </div>
              ))}
              {!audit.findings.length && <p className="text-xs text-ink-muted">No patterns detected in this period.</p>}
            </div>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="card">
            <SectionTitle title="Saved reports" subtitle={`${snapshot.reports.length} stored`} />
            <div className="space-y-1.5">
              {snapshot.reports.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-line/50 bg-bg-alt/40 px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium">{r.title}</p>
                    <p className="text-[10px] text-ink-muted">{new Date(r.createdAt).toLocaleDateString('en-US')} · {r.source.replace('-', ' ')}</p>
                  </div>
                  <button onClick={() => void deleteReport(r.id)} className="text-[10px] text-loss hover:underline">del</button>
                </div>
              ))}
              {!snapshot.reports.length && <p className="text-[11px] text-ink-muted">No saved reports yet.</p>}
            </div>
          </div>
          <div className="card">
            <SectionTitle title="What is inside every report" />
            <ul className="space-y-1 text-[11px] text-ink-muted">
              {['Performance & expectancy', 'Mistakes with financial impact', 'Strategy and session attribution', 'Psychology correlations', 'Risk and rule compliance', 'Corrective recommendations'].map((i) => <li key={i}>• {i}</li>)}
            </ul>
          </div>
        </aside>
      </div>

      {!snapshot.trades.length && (
        <div className="mt-3">
          <EmptyState title="No trades in this period" description="Choose a different period or log trades to populate the report." />
        </div>
      )}
      <p className="mt-3 text-center text-[10px] text-ink-muted/70">Total in range: {fmtMoney(scoped.reduce((s, t) => s + netPnl(t), 0), currency)} across {scoped.length} records.</p>
    </div>
  );
}
