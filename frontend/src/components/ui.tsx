import {
  createContext, forwardRef, useContext, useEffect, useId, useMemo, type ButtonHTMLAttributes,
  type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { ArrowDownRight, ArrowUpRight, Info, X } from 'lucide-react';
import { fmtMoney } from '../lib/calc';

/* ------------------------------- Button ------------------------------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: ReactNode;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, loading, className, children, disabled, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(variants[variant], size === 'sm' && 'px-3 py-1.5 text-xs', className)}
      {...rest}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
      {children}
    </button>
  );
});

/* ------------------------------- Fields ------------------------------- */

/** Lets a Field label a nested control without every call site passing an id. */
const FieldIdContext = createContext<string | undefined>(undefined);

export function Field({ label, hint, error, children, className }: { label?: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={clsx('min-w-0', className)}>
      {label && <label className="label" htmlFor={id}>{label}</label>}
      <FieldIdContext.Provider value={id}>{children}</FieldIdContext.Provider>
      {hint && !error && <p className="mt-1 text-[11px] leading-relaxed text-ink-muted/80">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-loss">{error}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { className, invalid, id, ...rest }, ref,
) {
  const fieldId = useContext(FieldIdContext);
  return <input ref={ref} id={id ?? fieldId} className={clsx('input', invalid && 'border-loss/70 focus:border-loss', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, id, ...rest }, ref,
) {
  const fieldId = useContext(FieldIdContext);
  return <textarea ref={ref} id={id ?? fieldId} className={clsx('input min-h-[90px] resize-y', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, id, ...rest }, ref,
) {
  const fieldId = useContext(FieldIdContext);
  return (
    <select ref={ref} id={id ?? fieldId} className={clsx('input appearance-none bg-[length:16px] pr-9', className)} {...rest}
      style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23A99AB9' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
      }}
    >
      {children}
    </select>
  );
});

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-ink">{label}</label>
        {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
      </div>
      <button
        id={id} type="button" role="switch" aria-checked={checked} aria-label={label}
        onClick={() => onChange(!checked)}
        className={clsx('relative h-6 w-11 shrink-0 rounded-full border transition-colors', checked ? 'border-primary/60 bg-primary/80' : 'border-line bg-elevated')}
      >
        <span className={clsx('absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white transition-all', checked ? 'left-[22px]' : 'left-0.5')} style={{ height: 18, width: 18 }} />
      </button>
    </div>
  );
}

/* -------------------------------- Card -------------------------------- */

export function Card({ className, children, as: As = 'div' }: { className?: string; children: ReactNode; as?: 'div' | 'section' }) {
  return <As className={clsx('card', className)}>{children}</As>;
}

export function SectionTitle({ title, subtitle, action, icon }: { title: string; subtitle?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {icon && <span className="rounded-xl bg-primary/15 p-2 text-primary-neon">{icon}</span>}
        <div>
          <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* -------------------------------- Stat -------------------------------- */

export function Stat({
  label, value, delta, hint, tone = 'neutral', icon, className,
}: {
  label: string; value: ReactNode; delta?: number; hint?: string;
  tone?: 'neutral' | 'profit' | 'loss' | 'primary'; icon?: ReactNode; className?: string;
}) {
  const toneCls = tone === 'profit' ? 'text-profit' : tone === 'loss' ? 'text-loss' : tone === 'primary' ? 'text-primary-neon' : 'text-ink';
  return (
    <div className={clsx('card card-hover relative overflow-hidden', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
        {icon && <span className="text-primary-neon/70">{icon}</span>}
      </div>
      <p className={clsx('mt-2 font-display text-xl font-semibold tabular-nums sm:text-2xl', toneCls)}>{value}</p>
      <div className="mt-1 flex items-center gap-1.5 text-[11px]">
        {typeof delta === 'number' && delta !== 0 && (
          <span className={clsx('inline-flex items-center gap-0.5 font-semibold', delta > 0 ? 'text-profit' : 'text-loss')}>
            {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {hint && <span className="truncate text-ink-muted">{hint}</span>}
      </div>
    </div>
  );
}

export function Metric({ label, value, tone, hint }: { label: string; value: ReactNode; tone?: 'profit' | 'loss' | 'neutral'; hint?: string }) {
  return (
    <div className="rounded-xl border border-line/60 bg-bg-alt/60 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className={clsx('mt-1 font-display text-base font-semibold tabular-nums', tone === 'profit' ? 'text-profit' : tone === 'loss' ? 'text-loss' : 'text-ink')}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-ink-muted">{hint}</p>}
    </div>
  );
}

export function Money({ value, currency = 'USD', className }: { value: number; currency?: string; className?: string }) {
  return <span className={clsx('tabular-nums', value > 0 ? 'text-profit' : value < 0 ? 'text-loss' : 'text-ink', className)}>{fmtMoney(value, currency)}</span>;
}

/* ------------------------------- Modal -------------------------------- */

export function Modal({ open, onClose, title, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('relative z-10 flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line bg-card shadow-2xl sm:rounded-2xl', width)}>
        <div className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3.5">
          <h3 className="truncate text-base font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-muted hover:bg-elevated hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="safe-bottom flex items-center justify-end gap-2 border-t border-line/70 px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm"
      footer={<><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <p className="text-sm leading-relaxed text-ink-muted">{message}</p>
    </Modal>
  );
}

/* ----------------------------- Empty state ---------------------------- */

export function EmptyState({ title, description, action, illustration }: { title: string; description: string; action?: ReactNode; illustration?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-card/40 px-6 py-12 text-center">
      {illustration ?? (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-sakura/20 text-primary-neon shadow-glow-sm">
          <Info className="h-7 w-7" />
        </div>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ------------------------------ Skeleton ------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />;
}

export function ChartSkeleton() {
  return (
    <div className="card">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-48 w-full" />
    </div>
  );
}

/* -------------------------------- Badge ------------------------------- */

export function Badge({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'profit' | 'loss' | 'primary' | 'warning'; children: ReactNode; className?: string }) {
  const map = {
    neutral: 'chip-neutral', profit: 'chip-profit', loss: 'chip-loss', primary: 'chip-primary',
    warning: 'chip border-sakura/40 bg-sakura/10 text-sakura',
  };
  return <span className={clsx(map[tone], className)}>{children}</span>;
}

export function ProgressBar({ value, max = 100, tone = 'primary', label, className }: { value: number; max?: number; tone?: 'primary' | 'profit' | 'loss' | 'warning'; label?: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  const bar = { primary: 'from-primary to-sakura', profit: 'from-profit to-emerald-300', loss: 'from-loss to-rose-400', warning: 'from-amber-400 to-sakura' }[tone];
  return (
    <div className={className}>
      {label && <div className="mb-1.5 flex justify-between text-[11px] text-ink-muted"><span>{label}</span><span className="tabular-nums">{pct.toFixed(0)}%</span></div>}
      <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
        <div className={clsx('h-full rounded-full bg-gradient-to-r transition-all duration-500', bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* -------------------------------- Tabs -------------------------------- */

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { value: T; label: string; icon?: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={clsx('flex gap-1 overflow-x-auto rounded-xl border border-line/70 bg-bg-alt/60 p-1', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={clsx(
            'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
            value === t.value ? 'bg-primary/25 text-ink shadow-glow-sm' : 'text-ink-muted hover:text-ink',
          )}
        >
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ Sparkline ----------------------------- */

export function Sparkbars({ data, className }: { data: number[]; className?: string }) {
  const max = useMemo(() => Math.max(1, ...data.map(Math.abs)), [data]);
  return (
    <div className={clsx('flex h-10 items-end gap-[3px]', className)}>
      {data.map((d, i) => (
        <div key={i} className={clsx('flex-1 rounded-sm', d >= 0 ? 'bg-profit/70' : 'bg-loss/70')}
          style={{ height: `${Math.max(6, (Math.abs(d) / max) * 100)}%` }} />
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-elevated px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">{children}</kbd>;
}

/** Circular score gauge used by the monthly audit and risk screens. */
export function ScoreDial({ score, label, sublabel, size = 132 }: { score: number; label?: string; sublabel?: string; size?: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const tone = clamped >= 75 ? '#47D7AC' : clamped >= 50 ? '#C084FC' : '#FF4D6D';
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(168,85,247,0.16)" strokeWidth={10} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={10} strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c - (c * clamped) / 100}
            style={{ transition: 'stroke-dashoffset .6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="font-display text-2xl font-bold tabular-nums leading-none" style={{ color: tone }}>{clamped}</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-wider text-ink-muted">/ 100</p>
          </div>
        </div>
      </div>
      {(label || sublabel) && (
        <div className="min-w-0">
          {label && <p className="font-display text-sm font-semibold">{label}</p>}
          {sublabel && <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{sublabel}</p>}
        </div>
      )}
    </div>
  );
}
