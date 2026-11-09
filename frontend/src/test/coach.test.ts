import { describe, expect, it } from 'vitest';
import { localCoachAnswer, SUGGESTED_QUESTIONS } from '../lib/ai/localCoach';
import { DEFAULT_RISK_SETTINGS } from '../lib/risk';
import { mkTrade } from './helpers';

const trades = [
  mkTrade({ exitPrice: 2390, exitTime: '2024-11-02T10:00:00.000Z' }),
  mkTrade({ exitPrice: 2370, exitTime: '2024-11-03T10:00:00.000Z', emotions: ['FOMO'], session: 'New York' }),
  mkTrade({ exitPrice: 2385, exitTime: '2024-11-04T10:00:00.000Z', instrument: 'XAUUSD' }),
];

describe('local statistical coach', () => {
  it('answers with a clear no-data message when the journal is empty', () => {
    const answer = localCoachAnswer('analyse my performance', [], DEFAULT_RISK_SETTINGS);
    expect(answer).toMatch(/No closed trades yet/i);
  });

  it('discloses that no AI key is configured', () => {
    const answer = localCoachAnswer('how am I doing', trades, DEFAULT_RISK_SETTINGS);
    expect(answer).toMatch(/Local statistical analysis/i);
  });

  it('routes performance questions to a metrics snapshot', () => {
    const answer = localCoachAnswer('how am I doing', trades, DEFAULT_RISK_SETTINGS);
    expect(answer).toMatch(/Net P&L/);
    expect(answer).toMatch(/Profit factor/);
  });

  it('routes session questions to a session table', () => {
    const answer = localCoachAnswer('compare London and New York sessions', trades, DEFAULT_RISK_SETTINGS);
    expect(answer).toMatch(/Session breakdown/);
    expect(answer).toMatch(/London/);
    expect(answer).toMatch(/New York/);
  });

  it('routes mistake questions to the top finding', () => {
    const answer = localCoachAnswer('what is my biggest mistake', trades, DEFAULT_RISK_SETTINGS);
    expect(answer).toMatch(/Biggest mistake/i);
  });

  it('handles gold-specific questions without inventing data', () => {
    const answer = localCoachAnswer('why am I losing on XAUUSD?', trades, DEFAULT_RISK_SETTINGS);
    expect(answer).toMatch(/XAUUSD/);
    expect(answer).not.toMatch(/undefined|NaN/);
  });

  it('never claims guaranteed profit', () => {
    const answer = localCoachAnswer('will I make money', trades, DEFAULT_RISK_SETTINGS);
    expect(answer.toLowerCase()).not.toMatch(/guaranteed|risk-free|sure profit/);
  });

  it('answers every suggested question without throwing or emitting NaN', () => {
    for (const q of SUGGESTED_QUESTIONS) {
      const answer = localCoachAnswer(q, trades, DEFAULT_RISK_SETTINGS);
      expect(answer.length).toBeGreaterThan(40);
      expect(answer).not.toMatch(/NaN/);
    }
  });
});
