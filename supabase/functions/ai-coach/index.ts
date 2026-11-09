/**
 * Segawa TradeAI — secure AI proxy.
 *
 * The provider API key lives only in this function's environment
 * (supabase secrets set OPENAI_API_KEY=...). The browser never sees it.
 *
 * Responsibilities: authenticate, validate, rate-limit, forward to an
 * OpenAI-compatible endpoint, and log token usage.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { corsHeaders, json } from '../_shared/cors.ts';

const MAX_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 6000;
const MAX_CONTEXT_CHARS = 60000;
const RATE_LIMIT_PER_HOUR = 30;

const DEFAULT_SYSTEM_PROMPT = `You are Hiro Segawa, the AI trading coach inside Segawa TradeAI.
Use ONLY the supplied trading context. Never invent trades, prices or statistics.
Label VERIFIED FACTS separately from INTERPRETATION. Never guarantee profit, never predict prices,
never claim to place trades. Keep answers concise, structured and actionable.
End with a one-line risk note when recommending risk changes. Markdown only.`;

interface Body {
  messages?: { role: string; content: string }[];
  context?: string;
  system?: string;
  model?: string;
  provider?: string;
  temperature?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Missing bearer token' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return json({ error: 'Unauthorized' }, 401);
  const userId = userData.user.id;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) return json({ error: 'messages[] is required' }, 400);
  if (messages.length > MAX_MESSAGES) return json({ error: `A maximum of ${MAX_MESSAGES} messages is allowed` }, 400);

  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return json({ error: 'Invalid message role' }, 400);
    if (typeof m.content !== 'string' || !m.content.trim()) return json({ error: 'Empty message content' }, 400);
    if (m.content.length > MAX_MESSAGE_CHARS) return json({ error: `Messages are limited to ${MAX_MESSAGE_CHARS} characters` }, 400);
  }

  const context = typeof body.context === 'string' ? body.context : '';
  if (context.length > MAX_CONTEXT_CHARS) return json({ error: 'Trading context is too large — narrow the date range' }, 413);

  // ---- rate limit / abuse guard -------------------------------------------
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await admin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);

  if (countError) console.error('rate limit check failed', countError.message);
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return json({ error: `Rate limit reached (${RATE_LIMIT_PER_HOUR} AI requests per hour). Try again later — the local statistical engine still works.` }, 429);
  }

  // ---- provider configuration --------------------------------------------
  const provider = (body.provider ?? Deno.env.get('AI_PROVIDER') ?? 'openai').toLowerCase();
  const baseUrl = (Deno.env.get('AI_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = body.model ?? Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini';
  const apiKey = Deno.env.get(
    provider === 'groq' ? 'GROQ_API_KEY'
      : provider === 'openrouter' ? 'OPENROUTER_API_KEY'
      : provider === 'together' ? 'TOGETHER_API_KEY'
      : 'OPENAI_API_KEY',
  );

  if (!apiKey) {
    return json({
      error: `No server-side API key configured for provider "${provider}". Set it with: supabase secrets set OPENAI_API_KEY=...`,
      code: 'missing_provider_key',
    }, 503);
  }

  const temperature = Math.min(2, Math.max(0, Number(body.temperature ?? 0.4)));

  const payload = {
    model,
    temperature,
    max_tokens: 1200,
    messages: [
      { role: 'system', content: body.system?.slice(0, 8000) || DEFAULT_SYSTEM_PROMPT },
      { role: 'system', content: `TRADING CONTEXT (JSON — never invent beyond this):\n${context}` },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return json({ error: `Provider unreachable: ${(err as Error).message}` }, 502);
  }

  if (!res.ok) {
    const detail = await res.text();
    console.error('provider error', res.status, detail.slice(0, 500));
    return json({ error: `Provider error ${res.status}`, detail: detail.slice(0, 400) }, 502);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? '';
  const tokens = Number(data?.usage?.total_tokens ?? 0) || 0;

  await admin.from('ai_usage').insert({ user_id: userId, model, tokens });
  if (!text) return json({ error: 'Provider returned an empty response' }, 502);

  return json({ text, usage: { tokens, model } });
});
