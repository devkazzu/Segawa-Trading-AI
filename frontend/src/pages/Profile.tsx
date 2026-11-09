import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Database, Download, LogOut, Save, Shield, Sparkles, Trash2, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/layout/AppShell';
import { Badge, Button, ConfirmDialog, Field, Input, Metric, SectionTitle } from '../components/ui';
import { Mascot } from '../components/brand';
import { useToast } from '../context/ToastContext';
import { fmtDate, fmtMoney, summarize } from '../lib/calc';
import { downloadText } from '../lib/export';

export default function Profile() {
  const { snapshot, mode, saveProfile, signOut, deleteAccount, loadDemoData, clearAllData } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(snapshot.profile.fullName);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const m = useMemo(() => summarize(snapshot.trades, snapshot.riskSettings.accountBalance), [snapshot.trades, snapshot.riskSettings.accountBalance]);

  const exportAll = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'Segawa TradeAI',
      version: '1.0.0',
      profile: { ...snapshot.profile, email: snapshot.profile.email },
      preferences: snapshot.preferences,
      riskSettings: snapshot.riskSettings,
      trades: snapshot.trades,
      strategies: snapshot.strategies,
      challenges: snapshot.challenges,
      psychology: snapshot.psychology,
      notes: snapshot.notes,
      reports: snapshot.reports,
      conversations: snapshot.conversations,
      messages: snapshot.messages,
    };
    downloadText(`segawa-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json');
    toast.success('Data exported', 'Full JSON backup downloaded.');
  };

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your identity, account state and data controls." />

      <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
        <div className="card">
          <div className="flex flex-col items-center text-center">
            <Mascot size="lg" />
            <h2 className="mt-3 font-display text-lg font-bold">{snapshot.profile.fullName || 'Trader'}</h2>
            <p className="text-xs text-ink-muted">{snapshot.profile.email}</p>
            <div className="mt-2 flex gap-1.5">
              <Badge tone={mode === 'supabase' ? 'profit' : 'warning'}>{mode === 'supabase' ? 'Supabase account' : 'Local demo account'}</Badge>
              <Badge tone="primary">{snapshot.profile.plan.toUpperCase()}</Badge>
            </div>
            <p className="mt-2 text-[10px] text-ink-muted">Member since {fmtDate(snapshot.profile.createdAt)}</p>
          </div>

          <div className="mt-4 space-y-2">
            <Field label="Display name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Button size="sm" className="w-full" onClick={() => { void saveProfile({ fullName: name.trim() || 'Trader' }); toast.success('Profile updated'); }} icon={<Save className="h-4 w-4" />}>Save name</Button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Metric label="Trades" value={snapshot.trades.length} />
            <Metric label="Win rate" value={`${m.winRate}%`} />
            <Metric label="Net P&L" value={fmtMoney(m.netPnl, snapshot.preferences.currency)} tone={m.netPnl >= 0 ? 'profit' : 'loss'} />
            <Metric label="Best streak" value={`W${m.maxWinStreak}`} />
          </div>

          <div className="mt-4 space-y-2">
            <Button variant="secondary" size="sm" className="w-full" onClick={() => { void signOut().then(() => navigate('/login')); }} icon={<LogOut className="h-4 w-4" />}>Sign out</Button>
            <Button variant="secondary" size="sm" className="w-full" onClick={() => navigate('/settings')} icon={<Shield className="h-4 w-4" />}>Settings & security</Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="card">
            <SectionTitle title="Account & data" icon={<Database className="h-4 w-4" />} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="secondary" size="sm" onClick={exportAll} icon={<Download className="h-4 w-4" />}>Export all data (JSON)</Button>
              <Button variant="secondary" size="sm" onClick={() => void loadDemoData().then(() => toast.success('Demo data loaded', 'Clearly labelled sample trades added.'))} icon={<Sparkles className="h-4 w-4" />}>Load demo dataset</Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirmClear(true)} icon={<Trash2 className="h-4 w-4" />}>Clear journal data</Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} icon={<Trash2 className="h-4 w-4" />}>Delete account</Button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-ink-muted">
              {mode === 'supabase'
                ? 'Your records live in your Supabase project protected by Row Level Security. Export any time; deletion removes your profile data permanently.'
                : 'Local demo mode stores everything in this browser. Export before clearing your browser data — there is no server copy.'}
            </p>
          </div>

          <div className="card">
            <SectionTitle title="Account summary" icon={<User className="h-4 w-4" />} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Equity" value={fmtMoney(m.currentEquity, snapshot.preferences.currency)} />
              <Metric label="Return" value={`${m.returnPct.toFixed(2)}%`} tone={m.returnPct >= 0 ? 'profit' : 'loss'} />
              <Metric label="Profit factor" value={m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)} />
              <Metric label="Avg risk" value={`${m.avgRiskPercent}%`} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <Link to="/reports" className="text-primary-neon hover:underline">Reports →</Link>
              <Link to="/audit" className="text-primary-neon hover:underline">Monthly audit →</Link>
              <Link to="/ai-config" className="text-primary-neon hover:underline">AI configuration →</Link>
            </div>
          </div>

          <div className="card">
            <SectionTitle title="Security posture" />
            <ul className="space-y-1.5 text-[11px] leading-relaxed text-ink-muted">
              <li>• Passwords are never stored in plain text: Supabase Auth uses bcrypt; local demo mode hashes with SHA-256 in this browser only.</li>
              <li>• Every Supabase table enforces Row Level Security keyed on <code>auth.uid()</code>.</li>
              <li>• AI API keys never enter the frontend bundle — they live in Edge Function secrets.</li>
              <li>• The app never executes trades and has no broker credentials.</li>
            </ul>
          </div>
        </div>
      </div>

      <ConfirmDialog open={confirmClear} title="Clear all journal data?" message="Trades, challenges, psychology entries, strategies, reports and AI conversations will be removed. Your account stays active." confirmLabel="Clear data" danger
        onConfirm={() => { void clearAllData().then(() => { toast.success('Journal cleared'); setConfirmClear(false); }); }}
        onCancel={() => setConfirmClear(false)} />

      <ConfirmDialog open={confirmDelete} title="Delete your account?" message="This permanently removes your profile and all trading data. It cannot be undone." confirmLabel="Delete everything" danger
        onConfirm={() => { void deleteAccount().then(() => navigate('/login')).catch((e) => toast.error('Deletion failed', e instanceof Error ? e.message : 'Unknown error')); }}
        onCancel={() => setConfirmDelete(false)} />
    </div>
  );
}
