import { clsx } from 'clsx';
import { useMemo } from 'react';

// WebP keeps the hero artwork ~150 kB instead of ~2 MB on mobile connections.
export const MASCOT_SRC = `${import.meta.env.BASE_URL}brand/hiro-segawa.webp`;

/** Hiro Segawa — the official Segawa TradeAI mascot. Always the same art. */
export function Mascot({ size = 'md', className, glow = true }: { size?: 'xs' | 'sm' | 'md' | 'lg' | 'hero'; className?: string; glow?: boolean }) {
  const dims = { xs: 'h-8 w-8', sm: 'h-12 w-12', md: 'h-20 w-20', lg: 'h-32 w-32', hero: 'h-64 w-64 sm:h-80 sm:w-80' }[size];
  const radius = size === 'hero' ? 'rounded-[2rem]' : size === 'xs' || size === 'sm' ? 'rounded-full' : 'rounded-2xl';
  return (
    <div className={clsx('relative shrink-0', dims, className)}>
      {glow && <div className="absolute -inset-2 rounded-[inherit] bg-primary/25 blur-2xl" aria-hidden />}
      <img
        src={MASCOT_SRC}
        alt="Hiro Segawa, AI trading coach mascot"
        loading={size === 'hero' ? 'eager' : 'lazy'}
        className={clsx('relative h-full w-full object-cover object-top ring-1 ring-primary/40', radius)}
      />
    </div>
  );
}

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-btn-primary shadow-glow">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#160a1f]" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17l5-5 3.5 3.5L21 6" />
          <path d="M15 6h6v6" />
        </svg>
      </div>
      {!compact && (
        <div className="leading-none">
          <p className="font-display text-[15px] font-bold tracking-tight text-ink">Segawa <span className="text-primary-neon">TradeAI</span></p>
          <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.18em] text-ink-muted">Trading Intelligence</p>
        </div>
      )}
    </div>
  );
}

/** Deterministic sakura petal field — decorative only, respects reduced motion. */
export function SakuraPetals({ count = 14, className }: { count?: number; className?: string }) {
  const petals = useMemo(
    () => Array.from({ length: count }).map((_, i) => {
      const seed = (i * 9301 + 49297) % 233280;
      const r = seed / 233280;
      return {
        left: `${(r * 100).toFixed(1)}%`,
        delay: `${(r * 12).toFixed(1)}s`,
        duration: `${14 + r * 16}s`,
        scale: 0.5 + r * 0.9,
        opacity: 0.25 + r * 0.4,
        key: i,
      };
    }),
    [count],
  );
  return (
    <div className={clsx('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      {petals.map((p) => (
        <span
          key={p.key}
          className="absolute top-0 animate-petal"
          style={{ left: p.left, animationDelay: p.delay, animationDuration: p.duration, transform: `scale(${p.scale})`, opacity: p.opacity }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 2c3.5 3.5 5 6.5 5 9a5 5 0 0 1-10 0c0-2.5 1.5-5.5 5-9Z" fill="url(#petal)" />
            <defs>
              <linearGradient id="petal" x1="12" y1="2" x2="12" y2="20" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FF79C6" stopOpacity="0.95" />
                <stop offset="1" stopColor="#A855F7" stopOpacity="0.45" />
              </linearGradient>
            </defs>
          </svg>
        </span>
      ))}
    </div>
  );
}

export function SakuraCorner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={clsx('pointer-events-none absolute opacity-20', className)} aria-hidden fill="none">
      <circle cx="60" cy="60" r="8" fill="#FF79C6" />
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="60" cy="38" rx="9" ry="17" fill="url(#g)" transform={`rotate(${a} 60 60)`} />
      ))}
      <defs>
        <linearGradient id="g" x1="60" y1="20" x2="60" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF79C6" /><stop offset="1" stopColor="#A855F7" stopOpacity="0.3" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function LoadingOrb({ label = 'Preparing your trading intelligence…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="relative grid h-20 w-20 place-items-center">
        <span className="absolute inset-0 animate-pulse-glow rounded-full" />
        <div className="h-16 w-16 overflow-hidden rounded-full ring-2 ring-primary/50">
          <img src={MASCOT_SRC} alt="" className="h-full w-full object-cover object-top" />
        </div>
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-sakura" style={{ animationDuration: '1.4s' }} />
      </div>
      <p className="max-w-xs text-center text-sm text-ink-muted">{label}</p>
    </div>
  );
}
