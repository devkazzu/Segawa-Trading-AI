import { MASCOT_SRC, Logo, SakuraPetals } from '../components/brand';

export default function Splash() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      <SakuraPetals count={18} />
      <div className="pointer-events-none absolute inset-0 bg-grid-glow" />
      <div className="relative flex flex-col items-center animate-fade-up">
        <div className="relative">
          <div className="absolute -inset-6 rounded-full bg-primary/30 blur-3xl" />
          <div className="relative h-28 w-28 overflow-hidden rounded-[1.75rem] ring-2 ring-primary/50 shadow-glow">
            <img src={MASCOT_SRC} alt="Hiro Segawa" className="h-full w-full object-cover object-top" />
          </div>
          <span className="absolute -inset-3 animate-spin rounded-[2rem] border border-transparent border-t-sakura/70" style={{ animationDuration: '2.4s' }} />
        </div>
        <div className="mt-7">
          <Logo compact />
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
          Segawa <span className="bg-gradient-to-r from-primary-neon to-sakura bg-clip-text text-transparent">TradeAI</span>
        </h1>
        <p className="mt-2 text-sm text-ink-muted">Trade Smarter. Understand Better. Grow Consistently.</p>
        <div className="mt-8 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2 w-2 animate-pulse rounded-full bg-primary" style={{ animationDelay: `${i * 160}ms` }} />
          ))}
        </div>
        <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-ink-muted/70">Loading your journal</p>
      </div>
    </div>
  );
}
