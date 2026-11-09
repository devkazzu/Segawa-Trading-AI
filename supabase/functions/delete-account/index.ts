/**
 * Deletes the authenticated user and every row they own.
 * Requires the service-role key, which is only available inside this function.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { corsHeaders, json } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Missing bearer token' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return json({ error: 'Unauthorized' }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const userId = data.user.id;

  // Explicit child-first deletes (RLS cascades also cover this).
  const tables = [
    'ai_messages', 'ai_conversations', 'ai_trade_analyses', 'monthly_reports', 'notifications',
    'trade_screenshots', 'trades', 'journal_notes', 'psychology_entries', 'challenge_profiles',
    'strategies', 'risk_settings', 'user_preferences', 'accounts', 'ai_usage', 'profiles',
  ];
  for (const table of tables) {
    const { error: delError } = await admin.from(table).delete().eq('user_id', userId);
    if (delError) console.error(`cleanup ${table}:`, delError.message);
  }

  const { error: storageError } = await admin.storage.from('trade-screenshots').remove(
    (await admin.storage.from('trade-screenshots').list(userId)).data?.map((f) => `${userId}/${f.name}`) ?? [],
  );
  if (storageError) console.warn('storage cleanup:', storageError.message);

  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) return json({ error: authError.message }, 500);

  return json({ ok: true });
});
