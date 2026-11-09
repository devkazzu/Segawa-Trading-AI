import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Check, Mail, User, Lock } from 'lucide-react';
import { Logo, Mascot, SakuraPetals } from '../components/brand';
import { Button, Field, Input } from '../components/ui';
import { useApp } from '../context/AppContext';

export default function Register() {
  const { signUp, mode } = useApp();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const checks = useMemo(() => [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'One letter and one number', ok: /[a-zA-Z]/.test(password) && /\d/.test(password) },
    { label: 'Passwords match', ok: password.length > 0 && password === confirm },
  ], [password, confirm]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!checks[0].ok || !checks[1].ok) { setError('Please meet the password requirements.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await signUp(email, password, fullName);
      localStorage.setItem('segawa.onboarded', '1');
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col justify-center px-5 py-10">
      <SakuraPetals count={10} />
      <div className="relative mx-auto w-full max-w-md">
        <div className="flex items-center justify-between">
          <Logo />
          <Link to="/login" className="text-xs text-ink-muted hover:text-ink">Sign in</Link>
        </div>

        <div className="mt-7 flex items-center gap-3">
          <Mascot size="md" />
          <div>
            <h1 className="font-display text-2xl font-bold">Create your workspace</h1>
            <p className="mt-0.5 text-sm text-ink-muted">Start your trading intelligence journal.</p>
          </div>
        </div>

        {mode === 'local' && (
          <div className="mt-5 rounded-xl border border-sakura/30 bg-sakura/10 p-3 text-[11px] leading-relaxed text-sakura">
            <strong>Local demo mode:</strong> this account lives in this browser only. Add Supabase credentials to sync across devices.
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-3">
          <Field label="Full name">
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Hiro Segawa" className="pl-9" autoComplete="name" required />
            </div>
          </Field>
          <Field label="Email">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@trader.com" className="pl-9" autoComplete="email" required />
            </div>
          </Field>
          <Field label="Password">
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a strong password" className="pl-9" autoComplete="new-password" required />
            </div>
          </Field>
          <Field label="Confirm password">
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" autoComplete="new-password" required />
          </Field>

          <ul className="space-y-1">
            {checks.map((c) => (
              <li key={c.label} className={`flex items-center gap-2 text-[11px] ${c.ok ? 'text-profit' : 'text-ink-muted'}`}>
                <Check className={`h-3.5 w-3.5 ${c.ok ? 'opacity-100' : 'opacity-30'}`} /> {c.label}
              </li>
            ))}
          </ul>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-loss/40 bg-loss/10 p-2.5 text-xs text-loss">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <Button type="submit" loading={busy} className="w-full" icon={<ArrowRight className="h-4 w-4" />}>Create account</Button>
          <p className="text-center text-[10px] leading-relaxed text-ink-muted/70">
            Segawa TradeAI is an analytical journal. It does not execute trades and nothing here is financial advice.
          </p>
        </form>
      </div>
    </div>
  );
}
