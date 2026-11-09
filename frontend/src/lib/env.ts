/// <reference types="vite/client" />

export const ENV = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '',
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '',
  aiFunctionName: (import.meta.env.VITE_AI_FUNCTION as string | undefined) ?? 'ai-coach',
  appVersion: '1.0.0',
};

export const SUPABASE_CONFIGURED = Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey);

/** True when a key that must never ship in a browser bundle is present. */
export function detectLeakedSecrets(): string[] {
  const found: string[] = [];
  if (/sk-[A-Za-z0-9]{20,}/.test(ENV.supabaseAnonKey)) found.push('OpenAI-style secret key in VITE_SUPABASE_ANON_KEY');
  if (ENV.supabaseAnonKey.startsWith('sb_secret_') || ENV.supabaseAnonKey.startsWith('service_role')) {
    found.push('Supabase service-role key placed in the browser bundle');
  }
  return found;
}
