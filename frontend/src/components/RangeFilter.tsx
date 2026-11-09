import { useMemo, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { RANGE_OPTIONS, rangeToDates, type RangePreset } from '../lib/calc';
import { Input, Select } from './ui';
import type { DateRange } from '../lib/types';

export function useRange(initial: RangePreset = 'month') {
  const [preset, setPreset] = useState<RangePreset>(initial);
  const [custom, setCustom] = useState({ from: '', to: '' });
  const range: DateRange = useMemo(() => rangeToDates(preset, custom), [preset, custom]);
  return { preset, setPreset, custom, setCustom, range };
}

export function RangeFilter({ preset, setPreset, custom, setCustom, className }: {
  preset: RangePreset; setPreset: (p: RangePreset) => void;
  custom: { from: string; to: string }; setCustom: (c: { from: string; to: string }) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-xl border border-line bg-bg-alt/70 px-2.5 py-1.5">
          <CalendarRange className="h-4 w-4 text-primary-neon" />
          <Select value={preset} onChange={(e) => setPreset(e.target.value as RangePreset)} className="!border-0 !bg-transparent !py-0 !pl-0 !pr-6 !text-xs focus:!ring-0" aria-label="Date range">
            {RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="!w-auto !py-1.5 !text-xs" aria-label="From date" />
            <span className="text-xs text-ink-muted">to</span>
            <Input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="!w-auto !py-1.5 !text-xs" aria-label="To date" />
          </div>
        )}
      </div>
    </div>
  );
}
