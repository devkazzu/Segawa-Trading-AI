import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, Bot, CheckCircle2, Shield, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { Mascot, Logo, SakuraPetals } from '../components/brand';
import { Button } from '../components/ui';
import { useApp } from '../context/AppContext';

const SLIDES = [
  {
    icon: BarChart3,
    title: 'Journal every trade, automatically scored',
    body: 'Log XAUUSD, forex, indices, crypto or stocks with full broker specs. Segawa computes P&L, R-multiple, risk and expectancy from your real numbers — never sample data.',
    points: ['Auto P&L & R-multiple', 'Session, strategy & setup tagging', 'Screenshot evidence'],
  },
  {
    icon: Bot,
    title: 'Meet Hiro — your AI trading coach',
    body: 'Hiro reads your actual recorded performance, names your recurring mistakes, quantifies what they cost you and gives corrective actions you can measure.',
    points: ['Monthly intelligence audits', 'Per-trade investigation', 'Facts separated from interpretation'],
  },
  {
    icon: Shield,
    title: 'Protect the account before the profit',
    body: 'Position sizing from real tick specs, daily and weekly loss limits, drawdown guards and a prop-firm challenge tracker that warns you before you breach.',
    points: ['Lot size calculator', 'Daily loss & drawdown guards', 'Challenge phase progress'],
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const { user } = useApp();
  const slide = SLIDES[step];
  const finish = () => {
    localStorage.setItem('segawa.onboarded', '1');
    navigate(user ? '/' : '/login');
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden px-5 py-6">
      <SakuraPetals count={10} />
      <div className="relative flex items-center justify-between">
        <Logo />
        <button onClick={finish} className="text-xs font-medium text-ink-muted hover:text-ink">Skip</button>
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-6">
        <div className="flex justify-center">
          {step === 0 ? <Mascot size="lg" /> : (
            <div className="grid h-32 w-32 place-items-center rounded-3xl bg-gradient-to-br from-primary/30 to-sakura/20 shadow-glow">
              <slide.icon className="h-14 w-14 text-primary-neon" />
            </div>
          )}
        </div>

        <div className="mt-7 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sakura">Step {step + 1} of {SLIDES.length}</p>
          <h1 className="mt-2 font-display text-2xl font-bold leading-snug">{slide.title}</h1>
          <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{slide.body}</p>
        </div>

        <ul className="mt-6 space-y-2">
          {slide.points.map((p) => (
            <li key={p} className="flex items-center gap-2.5 rounded-xl border border-line/70 bg-card/60 px-3.5 py-2.5 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-profit" /> {p}
            </li>
          ))}
        </ul>

        <div className="mt-7 flex items-center justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button key={i} aria-label={`Go to step ${i + 1}`} onClick={() => setStep(i)}
              className={clsx('h-1.5 rounded-full transition-all', i === step ? 'w-7 bg-primary' : 'w-1.5 bg-line')} />
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>}
          <Button className="flex-1" onClick={() => (step === SLIDES.length - 1 ? finish() : setStep(step + 1))}
            icon={step === SLIDES.length - 1 ? <Sparkles className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}>
            {step === SLIDES.length - 1 ? 'Start trading smarter' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
