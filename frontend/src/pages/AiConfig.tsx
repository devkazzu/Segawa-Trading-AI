import { useState } from 'react';
import { AlertTriangle, CheckCircle2, KeyRound, Save, ShieldAlert, Sparkles, TestTube2, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/layout/AppShell';
import { Badge, Button, Field, Input, SectionTitle, Select } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { askAi, aiStatus, backendFor, keyStore } from '../lib/ai/client';
import { SYSTEM_PROMPT } from '../lib/ai/prompt';
import type { UserPreferences } from '../lib/types';

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'] },
  { value: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'] },
  { value: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', models: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet'] },
  { value: 'together', label: 'Together AI', baseUrl: 'https://api.together.xyz/v1', models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo'] },
  { value: 'custom', label: 'Custom OpenAI-compatible', baseUrl: '', models: [] },
];

export default function AiConfig() {
  const { snapshot, mode, savePreferences } = useApp();
  const toast = useToast();
  const [prefs, setPrefs] = useState<UserPreferences>(snapshot.preferences);
  const [apiKey, setApiKey] = useState(() => keyStore.get(snapshot.preferences.aiProvider));
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const provider = PROVIDERS.find((p) => p.value === prefs.aiProvider) ?? PROVIDERS[0];
  const aiCfg = { provider: prefs.aiProvider, model: prefs.aiModel, baseUrl: prefs.aiBaseUrl, temperature: prefs.aiTemperature };
  const status = aiStatus(aiCfg);

  const set = <K extends keyof UserPreferences>(k: K, v: UserPreferences[K]) => setPrefs((p) => ({ ...p, [k]: v }));

  const changeProvider = (value: string) => {
    const p = PROVIDERS.find((x) => x.value === value) ?? PROVIDERS[0];
    setPrefs((prev) => ({ ...prev, aiProvider: value, aiBaseUrl: p.baseUrl || prev.aiBaseUrl, aiModel: p.models[0] ?? prev.aiModel }));
    setApiKey(keyStore.get(value));
  };

  const save = async () => {
    if (prefs.aiTemperature < 0 || prefs.aiTemperature > 2) { toast.error('Temperature must be between 0 and 2'); return; }
    if (!/^https?:\/\//.test(prefs.aiBaseUrl)) { toast.error('Base URL must start with http:// or https://'); return; }
    keyStore.set(prefs.aiProvider, apiKey.trim());
    await savePreferences(prefs);
    setTestResult(null);
    toast.success('AI configuration saved', mode === 'supabase' ? 'The Edge Function reads its key from Supabase secrets.' : apiKey ? 'Your key is stored in this browser only.' : 'No key — the local engine will answer.');
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    keyStore.set(prefs.aiProvider, apiKey.trim());
    const res = await askAi({
      question: 'Reply with exactly the sentence: Segawa connection verified.',
      history: [], trades: snapshot.trades, settings: snapshot.riskSettings,
      cfg: { provider: prefs.aiProvider, model: prefs.aiModel, baseUrl: prefs.aiBaseUrl, temperature: prefs.aiTemperature },
    });
    setTestResult(res.source === 'local-analysis'
      ? { ok: false, message: res.warning ?? 'No provider configured — the local statistical engine answered instead.' }
      : { ok: true, message: `Connected via ${res.source}. Response: ${res.text.slice(0, 120)}` });
    setTesting(false);
  };

  return (
    <div>
      <PageHeader title="AI Configuration" subtitle="Choose the provider Hiro uses. Secrets never belong in the browser bundle." />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card">
          <SectionTitle title="Provider" icon={<Sparkles className="h-4 w-4" />} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Provider">
              <Select value={prefs.aiProvider} onChange={(e) => changeProvider(e.target.value)}>
                {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </Select>
            </Field>
            <Field label="Model" hint={provider.models.length ? `Suggested: ${provider.models.join(', ')}` : 'Enter your model id'}>
              <Input list="model-list" value={prefs.aiModel} onChange={(e) => set('aiModel', e.target.value)} />
              <datalist id="model-list">{provider.models.map((m) => <option key={m} value={m} />)}</datalist>
            </Field>
            <Field label="Base URL" className="sm:col-span-2"><Input value={prefs.aiBaseUrl} onChange={(e) => set('aiBaseUrl', e.target.value)} placeholder="https://api.openai.com/v1" /></Field>
            <Field label={`Temperature — ${prefs.aiTemperature}`} hint="0.2–0.5 keeps analysis factual" className="sm:col-span-2">
              <input type="range" min={0} max={1.5} step={0.05} value={prefs.aiTemperature} onChange={(e) => set('aiTemperature', Number(e.target.value))} className="w-full accent-[#A855F7]" />
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void save()} icon={<Save className="h-4 w-4" />}>Save configuration</Button>
            <Button size="sm" variant="secondary" onClick={() => void test()} loading={testing} icon={<TestTube2 className="h-4 w-4" />}>Test connection</Button>
          </div>

          {testResult && (
            <div className={`mt-2 flex items-start gap-2 rounded-xl border p-2.5 text-[11px] ${testResult.ok ? 'border-profit/40 bg-profit/10 text-profit' : 'border-sakura/40 bg-sakura/10 text-sakura'}`}>
              {testResult.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span className="break-words">{testResult.message}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="card">
            <SectionTitle title="Engine status" />
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Active path</span>
                <Badge tone={status.source === 'local-analysis' ? 'warning' : 'profit'}>{status.label}</Badge>
              </div>
              <p className="text-[11px] leading-relaxed text-ink-muted">{status.detail}</p>
              <p className="text-[11px] text-ink-muted">Resolved backend: <code className="text-primary-neon">{backendFor(aiCfg)}</code></p>
            </div>
          </div>

          <div className="card">
            <SectionTitle title="Bring-your-own-key (local mode)" icon={<KeyRound className="h-4 w-4" />} />
            {mode === 'supabase' ? (
              <p className="rounded-xl border border-profit/30 bg-profit/10 p-2.5 text-[11px] leading-relaxed text-profit">
                Supabase is configured, so requests are routed through the <code>{'ai-coach'}</code> Edge Function. Set <code>OPENAI_API_KEY</code> as a
                Supabase secret — do not paste a key into the browser.
              </p>
            ) : (
              <>
                <Field label="API key" hint="Stored only in this browser's localStorage. Never committed, never in the bundle.">
                  <div className="relative">
                    <Input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-…" autoComplete="off" spellCheck={false} />
                    <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-ink-muted hover:text-ink">{showKey ? 'hide' : 'show'}</button>
                  </div>
                </Field>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { keyStore.set(prefs.aiProvider, apiKey.trim()); toast.success('Key stored locally'); }} icon={<Save className="h-4 w-4" />}>Store key</Button>
                  <Button size="sm" variant="danger" onClick={() => { keyStore.clear(prefs.aiProvider); setApiKey(''); toast.success('Key removed'); }} icon={<Trash2 className="h-4 w-4" />}>Remove</Button>
                </div>
                <div className="mt-2 flex items-start gap-2 rounded-xl border border-sakura/40 bg-sakura/10 p-2.5 text-[10px] leading-relaxed text-sakura">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  BYOK is a convenience for local/demo use. A browser-stored key is accessible to anything running on this origin — for production, deploy the Edge Function and use Supabase secrets.
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 card">
        <SectionTitle title="System prompt (read-only)" subtitle="This is what the model receives — it is hard-coded server-side in production" />
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-line/60 bg-bg p-3 text-[10px] leading-relaxed text-ink-muted">{SYSTEM_PROMPT}</pre>
      </div>
    </div>
  );
}
