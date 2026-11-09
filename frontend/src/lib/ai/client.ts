import { supabase } from '../db';
import { ENV } from '../env';
import { SYSTEM_PROMPT, buildContextBlock } from './prompt';
import { localCoachAnswer } from './localCoach';
import type { RiskSettings, Trade } from '../types';

export type AiSource = 'supabase-edge' | 'byok' | 'local-analysis';

export interface AiConfig {
  provider: string;
  model: string;
  baseUrl: string;
  temperature: number;
}

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

const KEY_PREFIX = 'segawa.ai.key.';

/**
 * BYOK keys are stored ONLY in this browser's localStorage and are sent
 * directly to the provider. They are never compiled into the bundle, never
 * committed, and never written to the database. When Supabase is configured we
 * always prefer the edge function, which keeps the key server-side.
 */
export const keyStore = {
  get(provider: string): string {
    try { return localStorage.getItem(KEY_PREFIX + provider) ?? ''; } catch { return ''; }
  },
  set(provider: string, key: string) {
    try { key ? localStorage.setItem(KEY_PREFIX + provider, key) : localStorage.removeItem(KEY_PREFIX + provider); } catch { /* ignore */ }
  },
  clear(provider: string) {
    try { localStorage.removeItem(KEY_PREFIX + provider); } catch { /* ignore */ }
  },
};

export function backendFor(cfg: AiConfig): AiSource {
  if (supabase) return 'supabase-edge';
  if (keyStore.get(cfg.provider)) return 'byok';
  return 'local-analysis';
}

export function aiStatus(cfg: AiConfig): { source: AiSource; label: string; detail: string } {
  const source = backendFor(cfg);
  if (source === 'supabase-edge') {
    return { source, label: 'Secure server AI', detail: 'Requests go through the Supabase Edge Function — the API key never reaches the browser.' };
  }
  if (source === 'byok') {
    return { source, label: 'Bring-your-own-key (browser)', detail: 'Your key is stored in this browser only and sent directly to the provider. Use the Edge Function in production.' };
  }
  return { source, label: 'Local statistical engine', detail: 'No AI key configured — answers are computed from your own trade data by the built-in analytics engine.' };
}

const AI_TIMEOUT_MS = 45_000;

async function withTimeout<T>(p: Promise<T>, ms = AI_TIMEOUT_MS): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('The AI request timed out. Check your connection and provider settings.')), ms)),
  ]);
}

export interface AskOptions {
  question: string;
  history: ChatTurn[];
  trades: Trade[];
  settings: RiskSettings;
  cfg: AiConfig;
  mode?: 'chat' | 'report' | 'investigate';
  extra?: string;
}

/** Non-streaming request. Falls back to the local engine on any failure. */
export async function askAi(opts: AskOptions): Promise<{ text: string; source: AiSource; warning?: string }> {
  const { question, history, trades, settings, cfg } = opts;
  const context = buildContextBlock(trades, settings);
  const source = backendFor(cfg);

  if (source === 'local-analysis') {
    return { text: localCoachAnswer(question, trades, settings), source };
  }

  const userContent = opts.extra ? `${question}\n\n${opts.extra}` : question;

  try {
    if (source === 'supabase-edge') {
      const { data, error } = await withTimeout(
        supabase!.functions.invoke(ENV.aiFunctionName, {
          body: { messages: [...history.slice(-8), { role: 'user', content: userContent }], context, system: SYSTEM_PROMPT, model: cfg.model, provider: cfg.provider, temperature: cfg.temperature },
        }),
      );
      if (error) throw new Error(error.message);
      if (!data?.text) throw new Error(data?.error ?? 'The AI function returned an empty response.');
      return { text: String(data.text), source };
    }

    // BYOK — OpenAI-compatible Chat Completions.
    const key = keyStore.get(cfg.provider);
    const res = await withTimeout(fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: cfg.model,
        temperature: cfg.temperature,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: `TRADING CONTEXT (JSON, do not invent beyond this):\n${context}` },
          ...history.slice(-8),
          { role: 'user', content: userContent },
        ],
      }),
    }));
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Provider error ${res.status}: ${body.slice(0, 240)}`);
    }
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    if (!text) throw new Error('The provider returned an empty response.');
    return { text: String(text), source };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown AI error';
    return {
      text: `${localCoachAnswer(question, trades, settings)}\n\n---\n**AI provider unavailable** — ${message}\nI answered with the local statistical engine so you are never blocked.`,
      source: 'local-analysis',
      warning: message,
    };
  }
}

/** Streaming request for OpenAI-compatible BYOK endpoints; yields text chunks. */
export async function* streamAi(opts: AskOptions): AsyncGenerator<string, void, unknown> {
  const { question, history, trades, settings, cfg } = opts;
  const source = backendFor(cfg);
  if (source !== 'byok') {
    const res = await askAi(opts);
    yield res.text;
    return;
  }
  const key = keyStore.get(cfg.provider);
  const context = buildContextBlock(trades, settings);
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: cfg.model, temperature: cfg.temperature, stream: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: `TRADING CONTEXT (JSON, do not invent beyond this):\n${context}` },
        ...history.slice(-8),
        { role: 'user', content: question },
      ],
    }),
  });
  if (!res.ok || !res.body) {
    const fallback = await askAi(opts);
    yield fallback.text;
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let emitted = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) { emitted += delta; yield delta; }
      } catch { /* partial JSON — ignore */ }
    }
  }
  if (!emitted) {
    const fallback = await askAi(opts);
    yield fallback.text;
  }
}
