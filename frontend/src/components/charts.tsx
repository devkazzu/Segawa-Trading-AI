import { useMemo } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { EquityPoint } from '../lib/calc';
import { fmtMoney } from '../lib/calc';

const AXIS = { stroke: '#A99AB9', fontSize: 11 };
const GRID = '#38244D';

const tooltipStyle = {
  contentStyle: {
    background: 'rgba(26,16,40,0.97)', border: '1px solid #38244D', borderRadius: 12,
    fontSize: 12, color: '#F8F4FF', boxShadow: '0 12px 30px -12px rgba(0,0,0,.9)',
  },
  labelStyle: { color: '#C084FC', fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: '#F8F4FF' },
};

const money = (v: number) => fmtMoney(v, 'USD', 0);
const shortDate = (iso: string) => {
  if (iso === 'start') return 'Start';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
};

export function EquityChart({ data, height = 260, currency = 'USD' }: { data: EquityPoint[]; height?: number; currency?: string }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A855F7" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#A855F7" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} minTickGap={28} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => fmtMoney(Number(v), currency, 0)} tick={AXIS} axisLine={false} tickLine={false} width={72} domain={['auto', 'auto']} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => [fmtMoney(v, currency), 'Equity']} labelFormatter={(l) => (l === 'start' ? 'Account start' : shortDate(String(l)))} />
          <Area type="monotone" dataKey="equity" stroke="#C084FC" strokeWidth={2.5} fill="url(#eqFill)" dot={false} activeDot={{ r: 4, fill: '#FF79C6' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DailyPnlChart({ data, height = 220 }: { data: { date: string; pnl: number }[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} minTickGap={20} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => money(Number(v))} tick={AXIS} axisLine={false} tickLine={false} width={64} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => [money(v), 'Net P&L']} labelFormatter={(l) => shortDate(String(l))} cursor={{ fill: 'rgba(168,85,247,0.08)' }} />
          <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#47D7AC' : '#FF4D6D'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyChart({ data, height = 240 }: { data: { label: string; pnl: number; trades: number; winRate: number }[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis yAxisId="l" tickFormatter={(v) => money(Number(v))} tick={AXIS} axisLine={false} tickLine={false} width={64} />
          <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={AXIS} axisLine={false} tickLine={false} width={34} tickFormatter={(v) => `${v}%`} />
          <Tooltip {...tooltipStyle} formatter={(v: number, n: string) => [n === 'pnl' ? money(v) : `${v}%`, n === 'pnl' ? 'Net P&L' : 'Win rate']} />
          <Bar yAxisId="l" dataKey="pnl" radius={[5, 5, 0, 0]} maxBarSize={38}>
            {data.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? 'url(#monthPos)' : 'url(#monthNeg)'} />)}
          </Bar>
          <Line yAxisId="r" type="monotone" dataKey="winRate" stroke="#FF79C6" strokeWidth={2} dot={{ r: 2.5, fill: '#FF79C6' }} />
          <defs>
            <linearGradient id="monthPos" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#47D7AC" /><stop offset="1" stopColor="#47D7AC" stopOpacity={0.35} /></linearGradient>
            <linearGradient id="monthNeg" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#FF4D6D" /><stop offset="1" stopColor="#FF4D6D" stopOpacity={0.35} /></linearGradient>
          </defs>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DrawdownChart({ data, height = 180 }: { data: EquityPoint[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.map((d) => ({ ...d, dd: -d.drawdown }))} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF4D6D" stopOpacity={0.05} />
              <stop offset="100%" stopColor="#FF4D6D" stopOpacity={0.45} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} minTickGap={28} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => money(Number(v))} tick={AXIS} axisLine={false} tickLine={false} width={64} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => [money(Math.abs(v)), 'Drawdown']} labelFormatter={(l) => shortDate(String(l))} />
          <Area type="monotone" dataKey="dd" stroke="#FF4D6D" strokeWidth={2} fill="url(#ddFill)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WinLossDonut({ wins, losses, breakevens, height = 180 }: { wins: number; losses: number; breakevens: number; height?: number }) {
  const data = useMemo(() => [
    { name: 'Wins', value: wins, fill: '#47D7AC' },
    { name: 'Losses', value: losses, fill: '#FF4D6D' },
    { name: 'Break-even', value: breakevens, fill: '#A99AB9' },
  ].filter((d) => d.value > 0), [wins, losses, breakevens]);

  if (!data.length) return <div className="grid h-40 place-items-center text-xs text-ink-muted">No closed trades yet</div>;

  return (
    <div style={{ height }} className="relative w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={3} stroke="none">
            {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Pie>
          <Tooltip {...tooltipStyle} formatter={(v: number, n: string) => [`${v} trades`, n]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="font-display text-xl font-bold text-profit">{wins}</p>
          <p className="text-[10px] uppercase tracking-wider text-ink-muted">wins</p>
        </div>
      </div>
    </div>
  );
}

export function HorizontalBarChart({ data, height = 220, valueKey = 'pnl', colorBySign = true }: {
  data: { name: string; [k: string]: string | number }[]; height?: number; valueKey?: string; colorBySign?: boolean;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 6" horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => money(Number(v))} tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ ...AXIS, fontSize: 10 }} width={96} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => [money(v), 'Net P&L']} cursor={{ fill: 'rgba(168,85,247,0.08)' }} />
          <Bar dataKey={valueKey} radius={[0, 5, 5, 0]} maxBarSize={22}>
            {data.map((d, i) => <Cell key={i} fill={colorBySign ? (Number(d[valueKey]) >= 0 ? '#47D7AC' : '#FF4D6D') : '#A855F7'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RDistributionChart({ data, height = 200 }: { data: { bucket: string; count: number; pnl: number }[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="bucket" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v} trades`, 'Count']} cursor={{ fill: 'rgba(168,85,247,0.08)' }} />
          <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={44}>
            {data.map((d, i) => <Cell key={i} fill={d.bucket.startsWith('-') ? '#FF4D6D' : '#A855F7'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
