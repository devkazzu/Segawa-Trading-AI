import { useMemo, useState } from 'react';
import { Brain, HeartPulse, Plus, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/layout/AppShell';
import { Badge, Button, EmptyState, Field, Input, Metric, Modal, SectionTitle, Textarea } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { fmtDate, fmtMoney, netPnl, rMultiple } from '../lib/calc';
import { uid } from '../lib/db';
import { EMOTIONS } from '../lib/instruments';
import type { PsychologyEntry } from '../lib/types';

const NEGATIVE = ['Fear', 'Greed', 'FOMO', 'Revenge', 'Stress', 'Overconfidence', 'Impatience', 'Hesitation'];

export default function Psychology() {
  const { snapshot, savePsych } = useApp();
  const toast = useToast();
  const currency = snapshot.preferences.currency;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PsychologyEntry>(() => ({
    id: uid(), date: new Date().toISOString().slice(0, 10), emotions: [], mood: 6, discipline: 6, stress: 4, note: '', createdAt: new Date().toISOString(),
  }));

  const closed = useMemo(() => snapshot.trades.filter((t) => t.status === 'closed'), [snapshot.trades]);

  const tags = useMemo(() => EMOTIONS.map((tag) => {
    const list = closed.filter((t) => t.emotions.includes(tag));
    const wins = list.filter((t) => netPnl(t) > 0).length;
    const rs = list.map(rMultiple).filter((r): r is number => r != null);
    return {
      tag, count: list.length, wins,
      pnl: list.reduce((s, t) => s + netPnl(t), 0),
      winRate: list.length ? (wins / list.length) * 100 : 0,
      avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0,
    };
  }).filter((t) => t.count > 0).sort((a, b) => b.count - a.count), [closed]);

  const negative = useMemo(() => {
    const withNeg = closed.filter((t) => t.emotions.some((e) => NEGATIVE.includes(e)));
    const without = closed.filter((t) => !t.emotions.some((e) => NEGATIVE.includes(e)));
    const avg = (arr: typeof closed) => (arr.length ? arr.reduce((s, t) => s + netPnl(t), 0) / arr.length : 0);
    const wr = (arr: typeof closed) => (arr.length ? (arr.filter((t) => netPnl(t) > 0).length / arr.length) * 100 : 0);
    return { withNeg, without, avgNeg: avg(withNeg), avgPos: avg(without), wrNeg: wr(withNeg), wrPos: wr(without) };
  }, [closed]);

  const chartData = useMemo(
    () => [...snapshot.psychology].sort((a, b) => a.date.localeCompare(b.date)).map((e) => ({
      date: e.date.slice(5), mood: e.mood, discipline: e.discipline, stress: e.stress,
    })),
    [snapshot.psychology],
  );

  const submit = async () => {
    await savePsych({ ...draft, createdAt: draft.createdAt || new Date().toISOString() });
    setOpen(false);
    toast.success('Psychology entry saved');
    setDraft({ id: uid(), date: new Date().toISOString().slice(0, 10), emotions: [], mood: 6, discipline: 6, stress: 4, note: '', createdAt: new Date().toISOString() });
  };

  return (
    <div>
      <PageHeader
        title="Trading Psychology"
        subtitle="Emotion tags are attached to trades — here is what each state actually costs you."
        actions={<Button size="sm" onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>New entry</Button>}
      />

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Tagged trades" value={closed.filter((t) => t.emotions.length).length} hint={`of ${closed.length} closed`} />
        <Metric label="Avg P&L in negative state" value={fmtMoney(negative.avgNeg, currency)} tone={negative.avgNeg >= 0 ? 'profit' : 'loss'} hint={`${negative.withNeg.length} trades`} />
        <Metric label="Avg P&L in neutral state" value={fmtMoney(negative.avgPos, currency)} tone={negative.avgPos >= 0 ? 'profit' : 'loss'} hint={`${negative.without.length} trades`} />
        <Metric label="Cost of emotional trading" value={fmtMoney(negative.avgPos - negative.avgNeg, currency)} tone="loss" hint="per trade, neutral − negative" />
      </div>

      {!closed.length ? (
        <EmptyState title="No trades to correlate yet" description="Tag each trade with its emotional state when you log it, and this page will quantify the behavioural cost." />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="card">
              <SectionTitle title="Emotional state vs outcome" icon={<Brain className="h-4 w-4" />} />
              <div className="table-wrap">
                <table className="w-full">
                  <thead><tr className="border-b border-line/60"><th className="th">State</th><th className="th text-right">Trades</th><th className="th text-right">Win %</th><th className="th text-right">Avg R</th><th className="th text-right">Net</th></tr></thead>
                  <tbody>
                    {tags.map((t) => (
                      <tr key={t.tag} className="border-b border-line/30 last:border-0">
                        <td className="td"><Badge tone={NEGATIVE.includes(t.tag) ? 'loss' : 'profit'}>{t.tag}</Badge></td>
                        <td className="td text-right tabular-nums">{t.count}</td>
                        <td className="td text-right tabular-nums">{t.winRate.toFixed(0)}%</td>
                        <td className="td text-right tabular-nums text-ink-muted">{t.avgR.toFixed(2)}</td>
                        <td className={clsx('td text-right tabular-nums', t.pnl >= 0 ? 'text-profit' : 'text-loss')}>{fmtMoney(t.pnl, currency)}</td>
                      </tr>
                    ))}
                    {!tags.length && <tr><td className="td text-ink-muted" colSpan={5}>No emotional tags recorded. Add them when logging trades.</td></tr>}
                  </tbody>
                </table>
              </div>
              {negative.withNeg.length >= 3 && (
                <div className="mt-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-[11px] leading-relaxed">
                  <p className="font-semibold text-primary-neon"><Sparkles className="mr-1 inline h-3.5 w-3.5" /> Verified finding</p>
                  <p className="mt-1 text-ink/90">
                    Trades taken in a negative emotional state won {negative.wrNeg.toFixed(0)}% vs {negative.wrPos.toFixed(0)}% in neutral states,
                    averaging {fmtMoney(negative.avgNeg, currency)} vs {fmtMoney(negative.avgPos, currency)} per trade.
                  </p>
                </div>
              )}
            </div>

            <div className="card">
              <SectionTitle title="Mood, discipline & stress" subtitle="From your psychology journal entries" icon={<HeartPulse className="h-4 w-4" />} />
              {chartData.length > 1 ? (
                <div style={{ height: 230 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid stroke="#38244D" strokeDasharray="3 6" vertical={false} />
                      <XAxis dataKey="date" tick={{ stroke: '#A99AB9', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 10]} tick={{ stroke: '#A99AB9', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: 'rgba(26,16,40,.97)', border: '1px solid #38244D', borderRadius: 12, fontSize: 12, color: '#F8F4FF' }} />
                      <Line type="monotone" dataKey="mood" stroke="#47D7AC" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="discipline" stroke="#A855F7" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="stress" stroke="#FF4D6D" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-10 text-center text-xs text-ink-muted">Add at least two psychology entries to see the trend.</p>
              )}
              <div className="mt-2 flex gap-3 text-[10px] text-ink-muted">
                <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-profit" /> mood</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-primary" /> discipline</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-loss" /> stress</span>
              </div>
            </div>
          </div>

          <div className="mt-3 card">
            <SectionTitle title="Psychology journal" subtitle={`${snapshot.psychology.length} entries`} />
            <div className="space-y-2">
              {[...snapshot.psychology].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
                <div key={e.id} className="rounded-xl border border-line/60 bg-bg-alt/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold">{fmtDate(e.date)}</p>
                    <div className="flex gap-2 text-[10px] text-ink-muted">
                      <span>mood {e.mood}/10</span><span>discipline {e.discipline}/10</span><span>stress {e.stress}/10</span>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{e.note || 'No note.'}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {e.emotions.map((tag) => <Badge key={tag} tone={NEGATIVE.includes(tag) ? 'loss' : 'profit'}>{tag}</Badge>)}
                  </div>
                </div>
              ))}
              {!snapshot.psychology.length && <p className="text-xs text-ink-muted">No entries yet. Journal how you felt before and after each session — patterns emerge fast.</p>}
            </div>
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Psychology entry" size="md"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => void submit()}>Save entry</Button></>}>
        <div className="space-y-3">
          <Field label="Date"><Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></Field>
          {(['mood', 'discipline', 'stress'] as const).map((k) => (
            <Field key={k} label={`${k[0].toUpperCase()}${k.slice(1)} — ${draft[k]}/10`}>
              <input type="range" min={1} max={10} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })} className="w-full accent-[#A855F7]" />
            </Field>
          ))}
          <div>
            <p className="label">Emotions</p>
            <div className="flex flex-wrap gap-1.5">
              {EMOTIONS.map((e) => (
                <button key={e} type="button" onClick={() => setDraft({ ...draft, emotions: draft.emotions.includes(e) ? draft.emotions.filter((x) => x !== e) : [...draft.emotions, e] })}
                  className={clsx('chip', draft.emotions.includes(e) ? 'border-primary/60 bg-primary/20 text-primary-neon' : 'border-line bg-elevated/50 text-ink-muted')}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <Field label="Note"><Textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="How did the session feel? What triggered the impulse?" /></Field>
        </div>
      </Modal>
    </div>
  );
}
