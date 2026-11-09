import { describe, expect, it } from 'vitest';
import { detectFindings, investigateTrade, runAudit } from '../lib/analysis';
import { DEFAULT_RISK_SETTINGS } from '../lib/risk';
import { mkTrade } from './helpers';

const settings = DEFAULT_RISK_SETTINGS;

describe('mistake detection', () => {
  it('detects a missing stop loss as a verified critical finding', () => {
    const findings = detectFindings([mkTrade({ stopLoss: null })], settings);
    const f = findings.find((x) => x.id === 'stop-manipulation');
    expect(f).toBeDefined();
    expect(f!.verified).toBe(true);
    expect(f!.severity).toBe('critical');
    expect(f!.tradeIds).toHaveLength(1);
  });

  it('detects risk above the configured cap and marks impact', () => {
    const trades = [
      mkTrade({ riskPercent: 4, exitPrice: 2370 }), // -100
      mkTrade({ riskPercent: 5, exitPrice: 2371 }),
    ];
    const f = detectFindings(trades, settings).find((x) => x.id === 'excessive-risk');
    expect(f).toBeDefined();
    expect(f!.frequency).toBe(2);
    expect(f!.verified).toBe(true);
    expect(f!.impact).toBeLessThan(0);
  });

  it('detects emotional tagging and rule violations from recorded fields', () => {
    const trades = [mkTrade({ emotions: ['FOMO', 'Revenge'], ruleChecklist: { 'Stop loss placed before entry': false } })];
    const ids = detectFindings(trades, settings).map((f) => f.id);
    expect(ids).toContain('emotional-trading');
    expect(ids).toContain('rule-violations');
    expect(ids).toContain('fomo');
  });

  it('detects a repeated losing setup', () => {
    const trades = Array.from({ length: 4 }).map((_, i) =>
      mkTrade({ setup: 'Double top fade', exitPrice: 2370, exitTime: `2024-11-0${i + 1}T10:00:00.000Z` }),
    );
    const f = detectFindings(trades, settings).find((x) => x.id.startsWith('losing-setup'));
    expect(f).toBeDefined();
    expect(f!.tradeIds).toHaveLength(4);
  });

  it('flags lot-size inconsistency only with enough spread in the sample', () => {
    const consistent = Array.from({ length: 6 }).map(() => mkTrade({ lotSize: 0.1 }));
    expect(detectFindings(consistent, settings).some((f) => f.id === 'lot-inconsistency')).toBe(false);

    const erratic = [0.02, 0.1, 0.5, 1, 0.05, 0.8].map((lotSize) => mkTrade({ lotSize }));
    expect(detectFindings(erratic, settings).some((f) => f.id === 'lot-inconsistency')).toBe(true);
  });

  it('marks proxy-based detectors as interpretations, not facts', () => {
    const trades = Array.from({ length: 3 }).map(() => mkTrade({ entryTime: '2024-11-01T11:45:00.000Z', session: 'London' }));
    const late = detectFindings(trades, settings).find((f) => f.id === 'late-entries');
    expect(late).toBeDefined();
    expect(late!.verified).toBe(false);
  });

  it('returns no findings for an empty journal', () => {
    expect(detectFindings([], settings)).toHaveLength(0);
  });

  it('sorts findings by severity', () => {
    const trades = [
      mkTrade({ stopLoss: null }),
      mkTrade({ riskPercent: 6 }),
      mkTrade({ emotions: ['FOMO'] }),
    ];
    const findings = detectFindings(trades, settings);
    expect(findings[0].severity).toBe('critical');
  });
});

describe('audit aggregation', () => {
  it('computes discipline, risk and execution scores', () => {
    const trades = [
      mkTrade({ ruleChecklist: { a: true, b: true } }),
      mkTrade({ ruleChecklist: { a: true, b: false } }),
    ];
    const audit = runAudit(trades, settings);
    expect(audit.disciplineScore).toBe(75);
    expect(audit.executionScore).toBe(100);
    expect(audit.riskScore).toBe(100);
    expect(audit.metrics.closedTrades).toBe(2);
  });

  it('groups sessions, strategies and psychology tags', () => {
    const audit = runAudit([mkTrade({ emotions: ['Fear'] }), mkTrade({ emotions: ['Fear'], exitPrice: 2376 })], settings);
    const fear = audit.psychology.find((p) => p.tag === 'Fear');
    expect(fear?.count).toBe(2);
    expect(audit.sessions[0].name).toBe('London');
  });
});

describe('trade investigation', () => {
  it('answers every investigation question with a verdict', () => {
    const res = investigateTrade(mkTrade(), [mkTrade()], settings);
    expect(res.items).toHaveLength(8);
    expect(res.score).toBeGreaterThan(0);
    expect(res.score).toBeLessThanOrEqual(100);
    expect(res.items.every((i) => typeof i.answer === 'string' && i.answer.length > 0)).toBe(true);
  });

  it('flags a trade without a stop and with no notes', () => {
    const res = investigateTrade(mkTrade({ stopLoss: null, notes: '', ruleChecklist: {} }), [], settings);
    expect(res.items.find((i) => i.question.includes('stop'))!.verdict).toBe('bad');
    expect(res.repeatedMistakes).toContain('Missing stop loss');
    expect(res.improvements.length).toBeGreaterThan(0);
  });

  it('marks premature exits using planned R:R versus realised R', () => {
    const trade = mkTrade({ entryPrice: 2380, exitPrice: 2381, stopLoss: 2376, takeProfit: 2396, lotSize: 1 });
    const res = investigateTrade(trade, [], settings);
    expect(res.items.find((i) => i.question.includes('exit'))!.verdict).toBe('warning');
  });
});
