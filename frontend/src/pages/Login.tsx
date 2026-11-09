import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, PlayCircle, ShieldCheck } from 'lucide-react';
import { Logo, Mascot, SakuraPetals } from '../components/brand';
import { Button, Field, Input } from '../components/ui';
import { useApp } from '../context/AppContext';

export default function Login() {
  const { signIn, enterDemo, mode } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const demo = async () => {
    setBusy(true);
    setError('');
    try {
      await enterDemo();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open demo mode.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] items-stretch">
      {/* brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-bg-alt via-bg to-[#1b0f2b] p-10 lg:flex">
        <SakuraPetals count={16} />
        <Logo />
        <div className="relative">
          <Mascot size="hero" className="mx-auto" />
          <h1 className="mt-8 font-display text-3xl font-bold leading-tight">
            Your edge lives in <span className="bg-gradient-to-r from-primary-neon to-sakura bg-clip-text text-transparent">your own data</span>.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
            Segawa TradeAI turns every logged trade into measurable intelligence — P&amp;L accuracy, R-multiples, mistake detection and an AI coach that never invents a number.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-[11px] text-ink-muted">
            {['XAUUSD first-class', 'Row Level Security', 'Offline-first journal', 'PDF & CSV export'].map((t) => (
              <span key={t} className="rounded-full border border-line bg-card/60 px-2.5 py-1">{t}</span>
            ))}
          </div>
        </div>
        <p className="relative text-[11px] text-ink-muted/70">Trade Smarter. Understand Better. Grow Consistently.</p>
      </div>

      {/* form panel */}
      <div className="relative flex w-full flex-col justify-center px-5 py-10 sm:px-10 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Logo />
          </div>
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <Mascot size="sm" />
            <p className="text-xs leading-snug text-ink-muted">Welcome back. Hiro is ready to review your journal.</p>
          </div>

          <h2 className="font-display text-2xl font-bold">Welcome back</h2>
          <p className="mt-1 text-sm text-ink-muted">Sign in to your trading intelligence workspace.</p>

          <div className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-[11px] leading-relaxed ${mode === 'supabase' ? 'border-profit/30 bg-profit/10 text-profit' : 'border-sakura/30 bg-sakura/10 text-sakura'}`}>
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            {mode === 'supabase'
              ? <span><strong>Supabase connected.</strong> Sessions, trades and AI conversations are stored in your own Supabase project with Row Level Security.</span>
              : <span><strong>Local demo mode.</strong> No Supabase credentials detected, so accounts and trades are stored only in this browser. Configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> for real multi-device accounts.</span>}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <Field label="Email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@trader.com" className="pl-9" autoComplete="email" required />
              </div>
            </Field>
            <Field label="Password">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <Input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-9 pr-10" autoComplete="current-password" required />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-muted hover:text-ink">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-loss/40 bg-loss/10 p-2.5 text-xs text-loss">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <Button type="submit" loading={busy} className="w-full" icon={<ArrowRight className="h-4 w-4" />}>Sign in</Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wider text-ink-muted/60">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>

          <Button variant="secondary" className="w-full" onClick={demo} loading={busy} icon={<PlayCircle className="h-4 w-4" />}>
            Explore with demo data
          </Button>
          <p className="mt-2 text-center text-[10px] leading-relaxed text-ink-muted/70">
            Demo mode loads a clearly-labelled sample dataset and writes to this browser only.
          </p>

          <p className="mt-6 text-center text-sm text-ink-muted">
            New to Segawa? <Link to="/register" className="font-semibold text-primary-neon hover:underline">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
