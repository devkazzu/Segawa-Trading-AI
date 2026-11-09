import { jsPDF } from 'jspdf';
import type { Finding, Trade } from './types';
import {
  closeTime, fmtMoney, holdingMinutes, netPnl, plannedRr, riskAmount, rMultiple, summarize, totalCosts, fmtDateTime,
} from './calc';

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8') {
  downloadBlob(filename, new Blob([text], { type: mime }));
}

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const TRADE_CSV_COLUMNS = [
  'id', 'instrument', 'market', 'direction', 'entryPrice', 'exitPrice', 'stopLoss', 'takeProfit',
  'lotSize', 'contractSize', 'tickSize', 'tickValue', 'entryTime', 'exitTime', 'session', 'timeframe',
  'strategy', 'setup', 'riskPercent', 'riskAmount', 'commission', 'swap', 'spread', 'fees',
  'grossPnl', 'netPnl', 'rMultiple', 'plannedRR', 'holdingMinutes', 'status', 'emotions', 'notes',
] as const;

export function tradesToCsv(trades: Trade[]): string {
  const header = TRADE_CSV_COLUMNS.join(',');
  const rows = trades.map((t) => [
    t.id, t.instrument, t.market, t.direction, t.entryPrice, t.exitPrice, t.stopLoss, t.takeProfit,
    t.lotSize, t.contractSize, t.tickSize, t.tickValue, t.entryTime, t.exitTime, t.session, t.timeframe,
    t.strategy, t.setup, t.riskPercent, riskAmount(t), totalCosts(t),
    (t.commission || 0), (t.swap || 0), (t.spread || 0), (t.fees || 0),
    netPnl(t) + totalCosts(t), netPnl(t), rMultiple(t) ?? '', plannedRr(t) ?? '', holdingMinutes(t) ?? '',
    t.status, (t.emotions || []).join('|'), (t.notes || '').replace(/\n/g, ' '),
  ].map(esc).join(','));
  return [header, ...rows].join('\r\n');
}

export function exportTradesCsv(trades: Trade[], filename = 'segawa-trades.csv') {
  downloadText(filename, `\uFEFF${tradesToCsv(trades)}`, 'text/csv;charset=utf-8');
}

export interface PdfReportInput {
  title: string;
  subtitle: string;
  ownerName: string;
  trades: Trade[];
  startingBalance: number;
  findings?: Finding[];
  narrative?: string;
  recommendations?: string[];
}

export function buildReportPdf(input: PdfReportInput): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 44;
  let y = margin;

  const setFont = (style: 'normal' | 'bold' = 'normal', size = 10) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
  };

  const newPageIfNeeded = (needed = 18) => {
    if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
  };

  const write = (text: string, opts: { size?: number; style?: 'normal' | 'bold'; color?: [number, number, number]; gap?: number; indent?: number } = {}) => {
    const { size = 10, style = 'normal', color = [40, 30, 55], gap = 5, indent = 0 } = opts;
    setFont(style, size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, pageW - margin * 2 - indent) as string[];
    for (const line of lines) {
      newPageIfNeeded(size + 4);
      doc.text(line, margin + indent, y);
      y += size + 3;
    }
    y += gap;
  };

  doc.setFillColor(10, 7, 20);
  doc.rect(0, 0, pageW, 92, 'F');
  setFont('bold', 20);
  doc.setTextColor(248, 244, 255);
  doc.text('SEGAWA TRADEAI', margin, 44);
  setFont('normal', 10);
  doc.setTextColor(192, 132, 252);
  doc.text(input.title, margin, 62);
  doc.text(input.subtitle, margin, 76);
  setFont('normal', 8);
  doc.setTextColor(169, 154, 185);
  doc.text(`Trader: ${input.ownerName}   ·   Generated: ${new Date().toLocaleString('en-US')}`, pageW - margin, 76, { align: 'right' });
  y = 118;

  const m = summarize(input.trades, input.startingBalance);
  write('Performance summary', { size: 13, style: 'bold', color: [88, 34, 120], gap: 8 });

  const metrics: [string, string][] = [
    ['Starting balance', fmtMoney(input.startingBalance)],
    ['Current equity', fmtMoney(m.currentEquity)],
    ['Net P&L', fmtMoney(m.netPnl)],
    ['Return', `${m.returnPct.toFixed(2)}%`],
    ['Total trades', String(m.totalTrades)],
    ['Closed trades', String(m.closedTrades)],
    ['Win / loss / BE', `${m.wins} / ${m.losses} / ${m.breakevens}`],
    ['Win rate', `${m.winRate.toFixed(2)}%`],
    ['Profit factor', m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)],
    ['Expectancy', fmtMoney(m.expectancy)],
    ['Average R', `${m.avgR.toFixed(2)}R`],
    ['Max drawdown', `${fmtMoney(m.maxDrawdown)} (${m.maxDrawdownPct.toFixed(2)}%)`],
    ['Best / worst trade', `${fmtMoney(m.bestTrade)} / ${fmtMoney(m.worstTrade)}`],
    ['Max win / loss streak', `${m.maxWinStreak} / ${m.maxLossStreak}`],
    ['Average risk', `${m.avgRiskPercent.toFixed(2)}%`],
    ['Total costs', fmtMoney(m.totalCosts)],
  ];

  const colW = (pageW - margin * 2) / 2;
  metrics.forEach(([label, value], i) => {
    if (i % 2 === 0) newPageIfNeeded(16);
    const x = margin + (i % 2) * colW;
    setFont('normal', 9); doc.setTextColor(110, 98, 125);
    doc.text(label, x, y);
    setFont('bold', 9); doc.setTextColor(30, 22, 45);
    doc.text(value, x + colW - 12, y, { align: 'right' });
    if (i % 2 === 1) y += 14;
  });
  if (metrics.length % 2 === 1) y += 14;
  y += 8;
  doc.setDrawColor(225, 215, 235);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  if (input.findings?.length) {
    write('Detected mistakes & risk patterns', { size: 13, style: 'bold', color: [88, 34, 120], gap: 8 });
    input.findings.slice(0, 12).forEach((f, i) => {
      write(`${i + 1}. ${f.title} — ${f.severity.toUpperCase()}${f.verified ? ' (verified)' : ' (interpretation)'}`, { style: 'bold', size: 10, gap: 2 });
      write(`${f.evidence}${f.impact ? ` Financial impact: ${fmtMoney(f.impact)}.` : ''}`, { size: 9, color: [70, 60, 85], gap: 2, indent: 10 });
      write(`Fix: ${f.correction}`, { size: 9, color: [70, 60, 85], gap: 8, indent: 10 });
    });
  }

  if (input.narrative) {
    newPageIfNeeded(40);
    write('AI analysis', { size: 13, style: 'bold', color: [88, 34, 120], gap: 8 });
    input.narrative.replace(/[#*]/g, '').split('\n').filter(Boolean).forEach((line) => {
      write(line.trim(), { size: 9, gap: 3 });
    });
    y += 6;
  }

  if (input.recommendations?.length) {
    newPageIfNeeded(40);
    write('Corrective actions', { size: 13, style: 'bold', color: [88, 34, 120], gap: 8 });
    input.recommendations.forEach((r, i) => write(`${i + 1}. ${r}`, { size: 9, gap: 4 }));
  }

  if (input.trades.length) {
    doc.addPage();
    y = margin;
    write('Trade log', { size: 13, style: 'bold', color: [88, 34, 120], gap: 8 });
    const headers = ['Date', 'Instrument', 'Dir', 'Session', 'Lots', 'Risk%', 'Net P&L', 'R'];
    const widths = [70, 70, 32, 76, 38, 40, 68, 38];
    const rowY = () => { if (y > pageH - margin - 20) { doc.addPage(); y = margin; drawHeader(); } };
    const drawHeader = () => {
      setFont('bold', 8); doc.setTextColor(110, 98, 125);
      let x = margin;
      headers.forEach((h, i) => { doc.text(h, x, y); x += widths[i]; });
      y += 10;
      doc.setDrawColor(230, 222, 240); doc.line(margin, y, pageW - margin, y); y += 8;
    };
    drawHeader();
    input.trades.slice(0, 400).forEach((t) => {
      rowY();
      setFont('normal', 8); doc.setTextColor(40, 30, 55);
      const cells = [
        new Date(closeTime(t)).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
        t.instrument, t.direction === 'buy' ? 'BUY' : 'SELL', t.session, t.lotSize.toFixed(2),
        `${t.riskPercent}%`, fmtMoney(netPnl(t)), rMultiple(t) != null ? `${rMultiple(t)!.toFixed(2)}` : '—',
      ];
      let x = margin;
      cells.forEach((c, i) => { doc.text(String(c), x, y); x += widths[i]; });
      y += 12;
    });
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    setFont('normal', 7);
    doc.setTextColor(150, 140, 160);
    doc.text('Segawa TradeAI · analytics generated from user-recorded trades · not financial advice', margin, pageH - 20);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 20, { align: 'right' });
  }
  return doc;
}

export function exportReportPdf(input: PdfReportInput, filename: string) {
  buildReportPdf(input).save(filename);
}

export function printCurrentView() {
  window.print();
}

export function tradeStatementText(t: Trade): string {
  return [
    `Segawa TradeAI — trade ${t.id}`,
    `${t.instrument} ${t.direction.toUpperCase()} · ${t.market} · ${t.status}`,
    `Entry ${t.entryPrice} · Exit ${t.exitPrice ?? '—'} · SL ${t.stopLoss ?? '—'} · TP ${t.takeProfit ?? '—'}`,
    `Lots ${t.lotSize} · Risk ${t.riskPercent}% (${fmtMoney(riskAmount(t))}) · Net ${fmtMoney(netPnl(t))} · R ${rMultiple(t) ?? '—'}`,
    `Opened ${fmtDateTime(t.entryTime)} · Closed ${fmtDateTime(t.exitTime)}`,
    `Notes: ${t.notes || '—'}`,
  ].join('\n');
}
