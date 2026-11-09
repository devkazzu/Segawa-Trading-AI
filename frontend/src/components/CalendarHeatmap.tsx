import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { calendarGrid, fmtMoney } from '../lib/calc';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function CalendarHeatmap({ days, initialMonth }: {
  days: Record<string, { pnl: number; count: number; wins: number; losses: number }>;
  initialMonth?: { year: number; month: number };
}) {
  const now = new Date();
  const [cursor, setCursor] = useState(initialMonth ?? { year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState<string | null>(null);

  const weeks = useMemo(() => calendarGrid(cursor.year, cursor.month, days), [cursor, days]);
  const monthMax = useMemo(() => Math.max(1, ...Object.values(days).map((d) => Math.abs(d.pnl))), [days]);
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const shift = (delta: number) => {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  const cellTone = (pnl: number, count: number) => {
    if (!count) return 'border-line/50 bg-bg-alt/50 text-ink-muted/50';
    if (pnl > 0) return 'border-profit/40 text-profit';
    if (pnl < 0) return 'border-loss/40 text-loss';
    return 'border-line text-ink-muted';
  };

  const cellStyle = (pnl: number, count: number) => {
    if (!count) return undefined;
    const intensity = Math.min(1, Math.abs(pnl) / monthMax);
    const alpha = 0.12 + intensity * 0.45;
    return { backgroundColor: pnl >= 0 ? `rgba(71,215,172,${alpha})` : `rgba(255,77,109,${alpha})` };
  };

  const selectedData = selected ? days[selected] : null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} aria-label="Previous month" className="rounded-lg border border-line p-1.5 text-ink-muted hover:text-ink"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => { const n = new Date(); setCursor({ year: n.getFullYear(), month: n.getMonth() }); }} className="rounded-lg border border-line px-2 py-1 text-[11px] text-ink-muted hover:text-ink">Today</button>
          <button onClick={() => shift(1)} aria-label="Next month" className="rounded-lg border border-line p-1.5 text-ink-muted hover:text-ink"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d, i) => <div key={i} className="pb-1 text-[10px] font-semibold text-ink-muted/60">{d}</div>)}
        {weeks.flat().map((cell) => (
          <button
            key={cell.date}
            onClick={() => setSelected(cell.date === selected ? null : cell.date)}
            className={clsx(
              'relative aspect-square rounded-lg border text-[10px] font-medium transition-transform hover:scale-[1.04]',
              cellTone(cell.pnl, cell.count),
              !cell.inMonth && 'opacity-35',
              cell.isFuture && 'opacity-20',
              selected === cell.date && 'ring-2 ring-primary',
            )}
            style={cellStyle(cell.pnl, cell.count)}
            title={cell.count ? `${cell.date}: ${fmtMoney(cell.pnl)} (${cell.count} trades)` : cell.date}
          >
            <span className="absolute left-1.5 top-1 tabular-nums">{cell.day}</span>
            {cell.count > 0 && (
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 font-display text-[9px] font-bold tabular-nums">
                {cell.pnl >= 0 ? '+' : ''}{Math.round(cell.pnl)}
              </span>
            )}
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-3 rounded-xl border border-line bg-bg-alt/70 p-3 text-xs">
          <p className="font-semibold">{selected}</p>
          {selectedData ? (
            <p className="mt-1 text-ink-muted">
              <span className={selectedData.pnl >= 0 ? 'text-profit' : 'text-loss'}>{fmtMoney(selectedData.pnl)}</span>
              {' '}· {selectedData.count} trade(s) · {selectedData.wins}W / {selectedData.losses}L
            </p>
          ) : <p className="mt-1 text-ink-muted">No closed trades on this day.</p>}
        </div>
      )}
    </div>
  );
}
