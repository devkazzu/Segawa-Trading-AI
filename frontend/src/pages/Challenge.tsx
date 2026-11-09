import { useMemo, useState } from 'react';
import { Flag, Pencil, Plus, Target, Trash2, Trophy } from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/layout/AppShell';
import { Badge, Button, ConfirmDialog, EmptyState, Field, Input, Metric, Modal, ProgressBar, SectionTitle, Select, Textarea } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { fmtDate, fmtMoney, summarize } from '../lib/calc';
import { uid } from '../lib/db';
import type { ChallengeProfile } from '../lib/types';

const blank = (balance: number): ChallengeProfile => ({
  id: uid(), name: 'Phase 1 evaluation', firm: 'Prop firm', startingBalance: balance, currentBalance: balance,
  profitTargetPct: 8, dailyDrawdownPct: 5, overallDrawdownPct: 10, phase: 'Phase 1',
  tradingDays: 0, minTradingDays: 5, startDate: new Date().toISOString(), status: 'active', notes: '',
});

export default function Challenge() {
  const { snapshot, saveChallenge, deleteChallenge } = useApp();
  const toast = useToast();
  const currency = snapshot.preferences.currency;
  const [editing, setEditing] = useState<ChallengeProfile | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const m = useMemo(() => summarize(snapshot.trades, snapshot.riskSettings.accountBalance), [snapshot.trades, snapshot.riskSettings.accountBalance]);

  const rows = snapshot.challenges.map((c) => {
    const profitTarget = (c.profitTargetPct / 100) * c.startingBalance;
    const gained = c.currentBalance - c.startingBalance;
    const remainingTarget = Math.max(0, profitTarget - gained);
    const dailyLossAllowance = (c.dailyDrawdownPct / 100) * c.startingBalance;
    const maxLossAllowance = (c.overallDrawdownPct / 100) * c.startingBalance;
    const used = Math.max(0, -gained);
    const remainingMaxLoss = Math.max(0, maxLossAllowance - used);
    const progress = profitTarget > 0 ? Math.min(100, (gained / profitTarget) * 100) : 0;
    const riskOfFail = maxLossAllowance > 0 ? (used / maxLossAllowance) * 100 : 0;
    return { c, profitTarget, gained, remainingTarget, dailyLossAllowance, maxLossAllowance, remainingMaxLoss, progress, riskOfFail };
  });

  const save = async (c: ChallengeProfile) => {
    if (!c.name.trim()) { toast.error('Name required'); return; }
    if (c.startingBalance <= 0) { toast.error('Starting balance must be positive'); return; }
    await saveChallenge(c);
    setEditing(null);
    toast.success('Challenge saved');
  };

  return (
    <div>
      <PageHeader
        title="Prop Firm Challenge Tracker"
        subtitle="Track evaluation progress, remaining target and drawdown room across multiple challenge profiles."
        actions={<Button size="sm" onClick={() => setEditing(blank(snapshot.riskSettings.accountBalance))} icon={<Plus className="h-4 w-4" />}>New challenge</Button>}
      />

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Active challenges" value={snapshot.challenges.filter((c) => c.status === 'active').length} />
        <Metric label="Passed" value={snapshot.challenges.filter((c) => c.status === 'passed').length} tone="profit" />
        <Metric label="Journal net P&L" value={fmtMoney(m.netPnl, currency)} tone={m.netPnl >= 0 ? 'profit' : 'loss'} hint="all recorded trades" />
        <Metric label="Current equity" value={fmtMoney(m.currentEquity, currency)} />
      </div>

      {!snapshot.challenges.length ? (
        <EmptyState
          illustration={<Trophy className="h-8 w-8 text-primary-neon" />}
          title="No challenge profiles yet"
          description="Add your evaluation details to see the exact profit target, drawdown room and remaining loss allowance in real time."
          action={<Button onClick={() => setEditing(blank(snapshot.riskSettings.accountBalance))} icon={<Plus className="h-4 w-4" />}>Create challenge</Button>}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map(({ c, profitTarget, gained, remainingTarget, dailyLossAllowance, maxLossAllowance, remainingMaxLoss, progress, riskOfFail }) => (
            <div key={c.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{c.name}</p>
                    <Badge tone={c.status === 'passed' ? 'profit' : c.status === 'failed' ? 'loss' : c.status === 'archived' ? 'neutral' : 'primary'}>{c.status}</Badge>
                  </div>
                  <p className="text-[11px] text-ink-muted">{c.firm} · {c.phase} · started {fmtDate(c.startDate)}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(c)} aria-label="Edit challenge" className="rounded-lg p-1.5 text-ink-muted hover:bg-elevated hover:text-primary-neon"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setConfirmId(c.id)} aria-label="Delete challenge" className="rounded-lg p-1.5 text-ink-muted hover:bg-loss/15 hover:text-loss"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Metric label="Balance" value={fmtMoney(c.currentBalance, currency)} hint={`start ${fmtMoney(c.startingBalance, currency)}`} />
                <Metric label="Progress" value={`${progress.toFixed(1)}%`} tone={gained >= 0 ? 'profit' : 'loss'} hint={`${fmtMoney(gained, currency)} gained`} />
                <Metric label="Remaining target" value={fmtMoney(remainingTarget, currency)} hint={`target ${fmtMoney(profitTarget, currency)}`} />
                <Metric label="Daily loss room" value={fmtMoney(dailyLossAllowance, currency)} hint={`${c.dailyDrawdownPct}% of start`} />
                <Metric label="Max loss room" value={fmtMoney(remainingMaxLoss, currency)} tone={riskOfFail > 70 ? 'loss' : 'neutral'} hint={`of ${fmtMoney(maxLossAllowance, currency)}`} />
                <Metric label="Trading days" value={`${c.tradingDays} / ${c.minTradingDays}`} hint="minimum required" />
              </div>

              <div className="mt-3 space-y-2">
                <ProgressBar label="Profit target" value={Math.max(0, gained)} max={profitTarget} tone={gained >= 0 ? 'profit' : 'loss'} />
                <ProgressBar label="Drawdown used" value={Math.max(0, -gained)} max={maxLossAllowance} tone="loss" />
                <ProgressBar label="Minimum trading days" value={c.tradingDays} max={c.minTradingDays} tone="primary" />
              </div>

              {riskOfFail >= 70 && c.status === 'active' && (
                <p className="mt-3 rounded-lg border border-loss/40 bg-loss/10 px-2.5 py-2 text-[11px] text-loss">
                  <Flag className="mr-1 inline h-3.5 w-3.5" /> You have used {riskOfFail.toFixed(0)}% of the maximum loss allowance. Reduce size or stand aside.
                </p>
              )}
              {remainingTarget === 0 && c.status === 'active' && (
                <p className="mt-3 rounded-lg border border-profit/40 bg-profit/10 px-2.5 py-2 text-[11px] text-profit">
                  <Target className="mr-1 inline h-3.5 w-3.5" /> Profit target reached — verify minimum trading days, then submit for review.
                </p>
              )}
              {c.notes && <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">{c.notes}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 card">
        <SectionTitle title="Challenge maths used here" />
        <div className="grid gap-2 text-[11px] text-ink-muted sm:grid-cols-2">
          <p className="rounded-lg border border-line/50 bg-bg-alt/40 p-2">Profit target = target % × starting balance.</p>
          <p className="rounded-lg border border-line/50 bg-bg-alt/40 p-2">Daily loss room = daily drawdown % × starting balance.</p>
          <p className="rounded-lg border border-line/50 bg-bg-alt/40 p-2">Max loss room = overall drawdown % × starting balance − realised loss.</p>
          <p className="rounded-lg border border-line/50 bg-bg-alt/40 p-2">Balance updates are manual; most firms compute daily drawdown from the day's starting equity, so confirm your firm's rule.</p>
        </div>
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing && snapshot.challenges.some((c) => c.id === editing.id) ? 'Edit challenge' : 'New challenge profile'}
        size="lg"
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={() => editing && void save(editing)}>Save challenge</Button></>}
      >
        {editing && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Profile name"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Prop firm"><Input value={editing.firm} onChange={(e) => setEditing({ ...editing, firm: e.target.value })} /></Field>
            <Field label="Starting balance"><Input type="number" value={editing.startingBalance} onChange={(e) => setEditing({ ...editing, startingBalance: Number(e.target.value) })} /></Field>
            <Field label="Current balance"><Input type="number" value={editing.currentBalance} onChange={(e) => setEditing({ ...editing, currentBalance: Number(e.target.value) })} /></Field>
            <Field label="Profit target (%)"><Input type="number" step="0.1" value={editing.profitTargetPct} onChange={(e) => setEditing({ ...editing, profitTargetPct: Number(e.target.value) })} /></Field>
            <Field label="Daily drawdown (%)"><Input type="number" step="0.1" value={editing.dailyDrawdownPct} onChange={(e) => setEditing({ ...editing, dailyDrawdownPct: Number(e.target.value) })} /></Field>
            <Field label="Overall drawdown (%)"><Input type="number" step="0.1" value={editing.overallDrawdownPct} onChange={(e) => setEditing({ ...editing, overallDrawdownPct: Number(e.target.value) })} /></Field>
            <Field label="Phase"><Input value={editing.phase} onChange={(e) => setEditing({ ...editing, phase: e.target.value })} /></Field>
            <Field label="Trading days"><Input type="number" value={editing.tradingDays} onChange={(e) => setEditing({ ...editing, tradingDays: Number(e.target.value) })} /></Field>
            <Field label="Minimum trading days"><Input type="number" value={editing.minTradingDays} onChange={(e) => setEditing({ ...editing, minTradingDays: Number(e.target.value) })} /></Field>
            <Field label="Status">
              <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as ChallengeProfile['status'] })}>
                <option value="active">Active</option><option value="passed">Passed</option><option value="failed">Failed</option><option value="archived">Archived</option>
              </Select>
            </Field>
            <Field label="Start date"><Input type="date" value={editing.startDate.slice(0, 10)} onChange={(e) => setEditing({ ...editing, startDate: new Date(e.target.value).toISOString() })} /></Field>
            <Field label="Notes" className="sm:col-span-2"><Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="Firm-specific rules, consistency rule, news-trading restrictions…" /></Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmId)}
        title="Delete challenge?"
        message="The profile and its progress history will be removed."
        confirmLabel="Delete"
        danger
        onConfirm={() => { if (confirmId) void deleteChallenge(confirmId).then(() => { toast.success('Challenge deleted'); setConfirmId(null); }); }}
        onCancel={() => setConfirmId(null)}
      />
      <p className={clsx('mt-3 text-center text-[10px] text-ink-muted/70')}>Balance updates are manual — Segawa does not connect to broker accounts or execute trades.</p>
    </div>
  );
}
