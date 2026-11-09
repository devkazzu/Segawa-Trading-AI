import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, ChevronRight, Download, FileText, Info, MonitorSmartphone, Save, Settings2, Shield, ShieldCheck, Sparkles, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/layout/AppShell';
import { Badge, Button, Field, Input, SectionTitle, Select, Toggle } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { ENV } from '../lib/env';
import { INSTRUMENTS } from '../lib/instruments';
import { isNative } from '../lib/native';
import { isStandalone, promptInstall } from '../lib/pwa';
import { fmtMoney, summarize } from '../lib/calc';
import type { UserPreferences } from '../lib/types';

const TIMEZONES = ['UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney'];

export default function Settings() {
  const { snapshot, savePreferences, saveRiskSettings, mode } = useApp();
  const toast = useToast();
  const [prefs, setPrefs] = useState<UserPreferences>(snapshot.preferences);
  const [dirty, setDirty] = useState(false);
  const set = <K extends keyof UserPreferences>(k: K, v: UserPreferences[K]) => { setPrefs((p) => ({ ...p, [k]: v })); setDirty(true); };
  const m = summarize(snapshot.trades, snapshot.riskSettings.accountBalance);

  const save = async () => {
    await savePreferences(prefs);
    await saveRiskSettings({ ...snapshot.riskSettings, accountBalance: prefs.startingBalance });
    setDirty(false);
    toast.success('Settings saved', 'Currency, balance and defaults updated across the app.');
  };

  const install = async () => {
    const result = await promptInstall();
    if (result === 'unsupported') toast.error('Install unavailable', 'Use your browser menu → “Add to Home screen”. On iOS use Share → Add to Home Screen.');
    else if (result === 'accepted') toast.success('Installing Segawa TradeAI');
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Preferences, data defaults and platform information." actions={dirty ? <Button size="sm" onClick={() => void save()} icon={<Save className="h-4 w-4" />}>Save changes</Button> : undefined} />

      {/* quick access — mirrors the reference settings list */}
      <div className="card mb-3 !p-2">
        {[
          { to: '/profile', label: 'Profile & account', hint: 'Name, avatar, account balance', icon: User },
          { to: '/ai-config', label: 'AI configuration', hint: 'Endpoint, model and connection test', icon: Sparkles },
          { to: '/notifications', label: 'Notifications', hint: 'Risk guard and audit alerts', icon: Bell },
          { to: '/reports', label: 'Reports & export', hint: 'Daily to annual, CSV / PDF / print', icon: FileText },
          { to: '/risk', label: 'Risk management', hint: 'Position sizing and loss limits', icon: Shield },
        ].map((r) => (
          <Link key={r.to} to={r.to} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-elevated/60">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-bg-alt text-primary-neon"><r.icon className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{r.label}</span>
              <span className="block truncate text-[11px] text-ink-muted">{r.hint}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />
          </Link>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card">
          <SectionTitle title="Trading defaults" icon={<Settings2 className="h-4 w-4" />} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Account currency">
              <Select value={prefs.currency} onChange={(e) => set('currency', e.target.value)}>
                {['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'AED', 'SGD'].map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Starting balance" hint="Used for equity, drawdown and return %">
              <Input type="number" step="0.01" value={prefs.startingBalance} onChange={(e) => set('startingBalance', Number(e.target.value))} />
            </Field>
            <Field label="Timezone">
              <Select value={prefs.timezone} onChange={(e) => set('timezone', e.target.value)}>
                {[...new Set([prefs.timezone, ...TIMEZONES])].map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Default instrument">
              <Select value={prefs.defaultInstrument} onChange={(e) => set('defaultInstrument', e.target.value)}>
                {INSTRUMENTS.map((i) => <option key={i.symbol} value={i.symbol}>{i.symbol}</option>)}
              </Select>
            </Field>
            <Field label="Default risk %"><Input type="number" step="0.1" value={prefs.defaultRiskPercent} onChange={(e) => set('defaultRiskPercent', Number(e.target.value))} /></Field>
            <Field label="Current equity (calculated)"><Input value={fmtMoney(m.currentEquity, prefs.currency)} readOnly className="opacity-70" /></Field>
          </div>
          <div className="mt-3 divide-y divide-line/40">
            <Toggle label="Show Hiro Segawa mascot" description="Character art across dashboard, coach and empty states." checked={prefs.mascotEnabled} onChange={(v) => set('mascotEnabled', v)} />
            <Toggle label="Compact mode" description="Tighter spacing for small screens." checked={prefs.compactMode} onChange={(v) => set('compactMode', v)} />
          </div>
          {dirty && <Button className="mt-3 w-full" size="sm" onClick={() => void save()} icon={<Check className="h-4 w-4" />}>Save preferences</Button>}
        </div>

        <div className="space-y-3">
          <div className="card">
            <SectionTitle title="Platform" icon={<MonitorSmartphone className="h-4 w-4" />} />
            <div className="space-y-2 text-xs">
              <Row label="Backend" value={mode === 'supabase' ? 'Supabase (PostgreSQL + RLS)' : 'Local demo (browser storage)'} badge={mode === 'supabase' ? 'profit' : 'warning'} />
              <Row label="App version" value={ENV.appVersion} />
              <Row label="Runtime" value={isNative() ? 'Android WebView (Capacitor)' : isStandalone() ? 'Installed PWA' : 'Web browser'} />
              <Row label="Service worker" value={'serviceWorker' in navigator ? 'Supported' : 'Unavailable'} />
              <Row label="AI endpoint" value={mode === 'supabase' ? `Edge Function: ${ENV.aiFunctionName}` : 'Local engine / BYOK'} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => void install()} icon={<Download className="h-4 w-4" />}>Install app</Button>
              <a href={`${import.meta.env.BASE_URL}manifest.webmanifest`} target="_blank" rel="noreferrer" className="btn-secondary !py-2 text-xs">View manifest</a>
            </div>
          </div>

          <div className="card">
            <SectionTitle title="Security notes" icon={<ShieldCheck className="h-4 w-4" />} />
            <ul className="space-y-1.5 text-[11px] leading-relaxed text-ink-muted">
              <li>• API keys belong in Supabase Edge Function secrets — never in <code>VITE_*</code> variables.</li>
              <li>• Use the anon key in the browser; the service-role key must stay server-side.</li>
              <li>• Row Level Security is mandatory: every table filters on <code>auth.uid()</code>.</li>
              <li>• Enable email confirmation and a minimum password policy in Supabase Auth.</li>
              <li>• Rotate keys immediately if a secret is ever pasted into chat or a repository.</li>
            </ul>
          </div>

          <div className="card">
            <SectionTitle title="About" icon={<Info className="h-4 w-4" />} />
            <p className="text-[11px] leading-relaxed text-ink-muted">
              Segawa TradeAI is an analytical trading journal, coach and risk manager. It does not execute orders, connect to broker APIs,
              or provide financial advice. All analytics are derived from trades you record manually.
            </p>
            <a href="https://github.com/devkazzu/Segawa-Trading-AI" target="_blank" rel="noreferrer" className="mt-2 inline-block text-[11px] font-semibold text-primary-neon hover:underline">Repository & documentation →</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, badge }: { label: string; value: string; badge?: 'profit' | 'warning' }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line/30 pb-1.5 last:border-0">
      <span className="text-ink-muted">{label}</span>
      {badge ? <Badge tone={badge}>{value}</Badge> : <span className="text-right font-medium text-ink">{value}</span>}
    </div>
  );
}
