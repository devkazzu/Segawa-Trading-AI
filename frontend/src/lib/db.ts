import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ENV, SUPABASE_CONFIGURED } from './env';
import type {
  AiConversation, AiMessage, ChallengeProfile, JournalNote, MonthlyReport, Notification,
  Profile, PsychologyEntry, RiskSettings, Strategy, Trade, UserPreferences,
} from './types';
import { DEFAULT_RULES } from './instruments';
import { DEFAULT_RISK_SETTINGS } from './risk';

/* ------------------------------------------------------------------ *
 * Supabase client — the anon key is public by design; every table is
 * protected by Row Level Security (see supabase/migrations).
 * ------------------------------------------------------------------ */
export const supabase: SupabaseClient | null = SUPABASE_CONFIGURED
  ? createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export type BackendMode = 'supabase' | 'local';

export interface Snapshot {
  profile: Profile;
  trades: Trade[];
  strategies: Strategy[];
  riskSettings: RiskSettings;
  challenges: ChallengeProfile[];
  notes: JournalNote[];
  psychology: PsychologyEntry[];
  conversations: AiConversation[];
  messages: AiMessage[];
  reports: MonthlyReport[];
  notifications: Notification[];
  preferences: UserPreferences;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  aiProvider: 'openai',
  aiModel: 'gpt-4o-mini',
  aiBaseUrl: 'https://api.openai.com/v1',
  aiTemperature: 0.4,
  currency: 'USD',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  startingBalance: 10000,
  defaultInstrument: 'XAUUSD',
  defaultRiskPercent: 1,
  compactMode: false,
  mascotEnabled: true,
};

export const emptySnapshot = (profile: Profile): Snapshot => ({
  profile,
  trades: [],
  strategies: [],
  riskSettings: { ...DEFAULT_RISK_SETTINGS },
  challenges: [],
  notes: [],
  psychology: [],
  conversations: [],
  messages: [],
  reports: [],
  notifications: [],
  preferences: { ...DEFAULT_PREFERENCES },
});

/* ------------------------------ helpers ------------------------------ */

const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export const toRow = (obj: Record<string, unknown>): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) row[toSnake(k)] = v;
  return row;
};

export const fromRow = <T>(row: Record<string, unknown> | null): T | null => {
  if (!row) return null;
  const obj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) obj[toCamel(k)] = v;
  return obj as T;
};

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

export const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------ *
 * Local repository (demo mode) — IndexedDB-free localStorage store.
 * Passwords are hashed with SHA-256 and remain device-local. This mode
 * is a genuine working app, but it is NOT a substitute for Supabase
 * auth: it is explicitly labelled "Local Demo Mode" in the UI.
 * ------------------------------------------------------------------ */

const LS = 'segawa.v1';
const SESSION_KEY = `${LS}.session`;
const USERS_KEY = `${LS}.users`;

interface LocalUser { id: string; email: string; passwordHash: string; fullName: string; createdAt: string }

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Segawa: local storage write failed', e);
  }
};

const sha256 = async (text: string): Promise<string> => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const tableKey = (userId: string, table: string) => `${LS}.${userId}.${table}`;

function localReadTable<T>(userId: string, table: string): T[] {
  return read<T[]>(tableKey(userId, table), []);
}
function localWriteTable<T>(userId: string, table: string, rows: T[]) {
  write(tableKey(userId, table), rows);
}

/* ------------------------------------------------------------------ *
 * Auth abstraction
 * ------------------------------------------------------------------ */

export interface AuthUser { id: string; email: string; fullName: string }

export interface AuthApi {
  mode: BackendMode;
  getSession(): Promise<AuthUser | null>;
  signUp(email: string, password: string, fullName: string): Promise<AuthUser>;
  signIn(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  deleteAccount(userId: string): Promise<void>;
}

const localAuth: AuthApi = {
  mode: 'local',
  async getSession() {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    const users = read<LocalUser[]>(USERS_KEY, []);
    const u = users.find((x) => x.id === id);
    return u ? { id: u.id, email: u.email, fullName: u.fullName } : null;
  },
  async signUp(email, password, fullName) {
    const users = read<LocalUser[]>(USERS_KEY, []);
    const clean = email.trim().toLowerCase();
    if (!clean.includes('@')) throw new Error('Enter a valid email address.');
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');
    if (users.some((u) => u.email === clean)) throw new Error('An account with this email already exists on this device.');
    const user: LocalUser = { id: uid(), email: clean, passwordHash: await sha256(password), fullName: fullName.trim() || clean.split('@')[0], createdAt: nowIso() };
    users.push(user);
    write(USERS_KEY, users);
    localStorage.setItem(SESSION_KEY, user.id);
    return { id: user.id, email: user.email, fullName: user.fullName };
  },
  async signIn(email, password) {
    const users = read<LocalUser[]>(USERS_KEY, []);
    const clean = email.trim().toLowerCase();
    const u = users.find((x) => x.email === clean);
    if (!u) throw new Error('No local account found for this email.');
    if (u.passwordHash !== (await sha256(password))) throw new Error('Incorrect password.');
    localStorage.setItem(SESSION_KEY, u.id);
    return { id: u.id, email: u.email, fullName: u.fullName };
  },
  async signOut() {
    localStorage.removeItem(SESSION_KEY);
  },
  async deleteAccount(userId) {
    const users = read<LocalUser[]>(USERS_KEY, []).filter((u) => u.id !== userId);
    write(USERS_KEY, users);
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`${LS}.${userId}.`))
      .forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(SESSION_KEY);
  },
};

const supabaseAuth: AuthApi = {
  mode: 'supabase',
  async getSession() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const u = data.session?.user;
    if (!u) return null;
    return { id: u.id, email: u.email ?? '', fullName: (u.user_metadata?.full_name as string) || u.email?.split('@')[0] || 'Trader' };
  },
  async signUp(email, password, fullName) {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Sign-up failed — check your email confirmation settings in Supabase.');
    if (!data.session) throw new Error('Account created. Check your email to confirm, then sign in.');
    return { id: data.user.id, email: data.user.email ?? email, fullName: fullName || email.split('@')[0] };
  },
  async signIn(email, password) {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message);
    const u = data.user;
    if (!u) throw new Error('Sign-in failed.');
    return { id: u.id, email: u.email ?? email, fullName: (u.user_metadata?.full_name as string) || email.split('@')[0] };
  },
  async signOut() {
    await supabase?.auth.signOut();
  },
  async deleteAccount() {
    if (!supabase) return;
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) throw new Error(`Account deletion failed: ${error.message}. Contact support to finish removal.`);
    await supabase.auth.signOut();
  },
};

export const auth: AuthApi = supabase ? supabaseAuth : localAuth;
export const backendMode: BackendMode = supabase ? 'supabase' : 'local';

/* ------------------------------------------------------------------ *
 * Data access
 * ------------------------------------------------------------------ */

async function sbSelect<T>(table: string, userId: string): Promise<T[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []).map((r) => fromRow<T>(r as Record<string, unknown>)!).filter(Boolean);
}

async function sbUpsert(table: string, row: Record<string, unknown>) {
  if (!supabase) return;
  const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' });
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function sbDelete(table: string, id: string) {
  if (!supabase) return;
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw new Error(`${table}: ${error.message}`);
}

export async function loadSnapshot(user: AuthUser): Promise<Snapshot> {
  const baseProfile: Profile = {
    id: user.id, email: user.email, fullName: user.fullName, avatarUrl: null, plan: 'free', createdAt: nowIso(),
  };

  if (!supabase) {
    const prefs = read<UserPreferences | null>(tableKey(user.id, 'preferences'), null);
    const risk = read<RiskSettings | null>(tableKey(user.id, 'risk_settings'), null);
    const localUser = read<LocalUser[]>(USERS_KEY, []).find((u) => u.id === user.id);
    return {
      profile: { ...baseProfile, createdAt: localUser?.createdAt ?? baseProfile.createdAt },
      trades: localReadTable<Trade>(user.id, 'trades'),
      strategies: localReadTable<Strategy>(user.id, 'strategies'),
      riskSettings: risk ?? { ...DEFAULT_RISK_SETTINGS },
      challenges: localReadTable<ChallengeProfile>(user.id, 'challenges'),
      notes: localReadTable<JournalNote>(user.id, 'notes'),
      psychology: localReadTable<PsychologyEntry>(user.id, 'psychology'),
      conversations: localReadTable<AiConversation>(user.id, 'conversations'),
      messages: localReadTable<AiMessage>(user.id, 'messages'),
      reports: localReadTable<MonthlyReport>(user.id, 'reports'),
      notifications: localReadTable<Notification>(user.id, 'notifications'),
      preferences: prefs ?? { ...DEFAULT_PREFERENCES },
    };
  }

  const [profiles, trades, strategies, riskRows, challenges, notes, psych, convs, msgs, reports, notifications, prefs] = await Promise.all([
    sbSelect<Profile>('profiles', user.id),
    sbSelect<Trade>('trades', user.id),
    sbSelect<Strategy>('strategies', user.id),
    sbSelect<RiskSettings>('risk_settings', user.id),
    sbSelect<ChallengeProfile>('challenge_profiles', user.id),
    sbSelect<JournalNote>('journal_notes', user.id),
    sbSelect<PsychologyEntry>('psychology_entries', user.id),
    sbSelect<AiConversation>('ai_conversations', user.id),
    sbSelect<AiMessage>('ai_messages', user.id),
    sbSelect<MonthlyReport>('monthly_reports', user.id),
    sbSelect<Notification>('notifications', user.id),
    sbSelect<UserPreferences>('user_preferences', user.id),
  ]);

  return {
    profile: { ...baseProfile, ...(profiles[0] ?? {}) },
    trades: trades.sort((a, b) => +new Date(b.entryTime) - +new Date(a.entryTime)),
    strategies,
    riskSettings: { ...DEFAULT_RISK_SETTINGS, ...(riskRows[0] ?? {}) },
    challenges,
    notes,
    psychology: psych,
    conversations: convs.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
    messages: msgs.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    reports: reports.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    notifications: notifications.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    preferences: { ...DEFAULT_PREFERENCES, ...(prefs[0] ?? {}) },
  };
}

type TableName =
  | 'trades' | 'strategies' | 'challenges' | 'notes' | 'psychology' | 'conversations'
  | 'messages' | 'reports' | 'notifications' | 'risk_settings' | 'preferences' | 'profiles';

const TABLE_MAP: Record<TableName, string> = {
  trades: 'trades',
  strategies: 'strategies',
  challenges: 'challenge_profiles',
  notes: 'journal_notes',
  psychology: 'psychology_entries',
  conversations: 'ai_conversations',
  messages: 'ai_messages',
  reports: 'monthly_reports',
  notifications: 'notifications',
  risk_settings: 'risk_settings',
  preferences: 'user_preferences',
  profiles: 'profiles',
};

export interface RepoApi {
  mode: BackendMode;
  saveTable(userId: string, table: TableName, value: object, singleton?: boolean): Promise<void>;
  deleteRow(userId: string, table: TableName, id: string): Promise<void>;
  saveAll(userId: string, tables: Partial<Record<TableName, unknown>>): Promise<void>;
}

const localRepo: RepoApi = {
  mode: 'local',
  async saveTable(userId, table, value, singleton) {
    if (singleton) {
      write(tableKey(userId, table), value);
      return;
    }
    const rows = localReadTable<{ id: string }>(userId, table);
    const id = (value as { id: string }).id;
    const idx = rows.findIndex((r) => r.id === id);
    if (idx >= 0) rows[idx] = value as { id: string };
    else rows.push(value as { id: string });
    localWriteTable(userId, table, rows);
  },
  async deleteRow(userId, table, id) {
    const rows = localReadTable<{ id: string }>(userId, table).filter((r) => r.id !== id);
    localWriteTable(userId, table, rows);
  },
  async saveAll(userId, tables) {
    for (const [table, value] of Object.entries(tables)) {
      const t = table as TableName;
      if (!value) continue;
      if (t === 'risk_settings' || t === 'preferences') write(tableKey(userId, t), value);
      else localWriteTable(userId, t, value as { id: string }[]);
    }
  },
};

const supabaseRepo: RepoApi = {
  mode: 'supabase',
  async saveTable(userId, table, value, singleton) {
    const row = toRow({ ...(value as Record<string, unknown>), userId });
    if (singleton && !('id' in row)) {
      const { error } = await supabase!.from(TABLE_MAP[table]).upsert(row, { onConflict: 'user_id' });
      if (error) throw new Error(`${TABLE_MAP[table]}: ${error.message}`);
      return;
    }
    await sbUpsert(TABLE_MAP[table], row);
  },
  async deleteRow(_userId, table, id) {
    await sbDelete(TABLE_MAP[table], id);
  },
  async saveAll(userId, tables) {
    for (const [table, value] of Object.entries(tables)) {
      const t = table as TableName;
      if (!value) continue;
      if (t === 'risk_settings' || t === 'preferences') await this.saveTable(userId, t, value as object, true);
      else await this.saveTable(userId, t, value as { id: string });
    }
  },
};

export const repo: RepoApi = supabase ? supabaseRepo : localRepo;

/* ------------------------ demo data generation ------------------------ */

export function seedDemoTrades(userId: string): Trade[] {
  const instruments = [
    { symbol: 'XAUUSD', market: 'commodities' as const, contractSize: 100, tickSize: 0.01, tickValue: 1, price: 2380 },
    { symbol: 'NAS100', market: 'indices' as const, contractSize: 1, tickSize: 0.25, tickValue: 0.25, price: 18200 },
    { symbol: 'EURUSD', market: 'forex' as const, contractSize: 100000, tickSize: 0.00001, tickValue: 1, price: 1.084 },
  ];
  const strategies = ['SMC', 'Order Block', 'FVG', 'Breakout', 'Liquidity Sweep', 'EMA Trend'];
  const setups = ['London sweep of Asian high', 'H4 order block retest', 'NY open FVG fill', 'Breakout + retest', 'CHoCH reversal'];
  const emotions = [['Confident', 'Discipline'], ['FOMO'], ['Fear'], ['Greed'], ['Confident'], ['Revenge'], []];
  const trades: Trade[] = [];
  const now = new Date();
  // Deterministic pseudo-random so the demo is reproducible.
  let seed = 42;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  for (let i = 0; i < 68; i++) {
    const inst = instruments[Math.floor(rnd() * instruments.length)];
    const daysAgo = Math.floor((i / 68) * 150) + 1;
    const entry = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 7 + Math.floor(rnd() * 12), Math.floor(rnd() * 59));
    const direction = rnd() > 0.48 ? 'buy' : 'sell';
    const lots = inst.symbol === 'EURUSD' ? 0.2 + Math.round(rnd() * 4) / 10 : 0.05 + Math.round(rnd() * 5) / 100;
    const stopDistance = inst.price * (inst.symbol === 'EURUSD' ? 0.0022 : 0.0025);
    const sl = direction === 'buy' ? inst.price - stopDistance : inst.price + stopDistance;
    const tp = direction === 'buy' ? inst.price + stopDistance * (1.2 + rnd() * 2) : inst.price - stopDistance * (1.2 + rnd() * 2);
    const win = rnd() < 0.56;
    const partial = rnd() < 0.18;
    const exitPrice = win
      ? direction === 'buy' ? tp - stopDistance * rnd() * 0.4 : tp + stopDistance * rnd() * 0.4
      : direction === 'buy' ? sl - stopDistance * rnd() * 0.1 : sl + stopDistance * rnd() * 0.1;
    const exit = new Date(entry.getTime() + (20 + rnd() * 300) * 60000);
    const riskPercent = 0.5 + Math.round(rnd() * 12) / 10;
    const ruleKeys = DEFAULT_RULES as readonly string[];
    const ruleChecklist: Record<string, boolean> = {};
    ruleKeys.forEach((r) => { ruleChecklist[r] = rnd() > 0.16; });
    const tag = emotions[Math.floor(rnd() * emotions.length)];
    const strategy = strategies[Math.floor(rnd() * strategies.length)];
    const entryPrice = direction === 'buy' ? inst.price + stopDistance * 0.05 : inst.price - stopDistance * 0.05;

    trades.push({
      id: uid(), userId, accountId: 'main',
      instrument: inst.symbol, market: inst.market, direction,
      entryPrice: Number(entryPrice.toFixed(5)), exitPrice: Number(exitPrice.toFixed(5)),
      stopLoss: Number(sl.toFixed(5)), takeProfit: Number(tp.toFixed(5)),
      lotSize: lots, quantity: lots, contractSize: inst.contractSize, tickSize: inst.tickSize, tickValue: inst.tickValue,
      currency: 'USD', entryTime: entry.toISOString(), exitTime: exit.toISOString(),
      session: (['Asian', 'London', 'London/NY Overlap', 'New York'] as const)[Math.floor(rnd() * 4)],
      timeframe: ['M5', 'M15', 'H1', 'H4'][Math.floor(rnd() * 4)],
      strategy, setup: setups[Math.floor(rnd() * setups.length)],
      riskPercent, commission: Number((lots * 3.5).toFixed(2)), swap: 0, spread: Number((lots * 0.8).toFixed(2)), fees: 0,
      status: 'closed', screenshots: [],
      notes: partial ? 'Took partials at 1R, trailed the rest.' : win ? 'Clean execution from the planned zone.' : 'Stopped out; entry was early relative to the sweep.',
      emotions: tag, ruleChecklist,
      createdAt: entry.toISOString(), updatedAt: exit.toISOString(),
    });
  }

  trades.sort((a, b) => +new Date(b.entryTime) - +new Date(a.entryTime));
  return trades;
}

export function seedDemoData(userId: string) {
  const trades = seedDemoTrades(userId);
  const challenges: ChallengeProfile[] = [
    {
      id: uid(), name: 'Phase 1 — $50K Evaluation', firm: 'Demo Prop Firm', startingBalance: 50000, currentBalance: 50000,
      profitTargetPct: 8, dailyDrawdownPct: 5, overallDrawdownPct: 10, phase: 'Phase 1', tradingDays: 0,
      minTradingDays: 5, startDate: nowIso(), status: 'active', notes: 'Sample challenge profile generated with demo data.',
    },
  ];
  const psych: PsychologyEntry[] = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i * 5);
    return {
      id: uid(), date: d.toISOString().slice(0, 10), emotions: i % 2 ? ['Confident'] : ['FOMO', 'Impatience'],
      mood: i % 2 ? 8 : 5, discipline: i % 2 ? 9 : 4, stress: i % 2 ? 3 : 7,
      note: i % 2 ? 'Followed the plan, only took A+ setups.' : 'Chased two entries after missing the first move.',
      createdAt: d.toISOString(),
    };
  });
  const strategies: Strategy[] = [
    { id: uid(), name: 'SMC London Sweep', description: 'Sweep of the Asian range high/low, then CHoCH on M5.', rules: ['Asian range marked', 'Liquidity sweep', 'CHoCH confirmation', 'FVG entry'], createdAt: nowIso() },
    { id: uid(), name: 'NY Open OB Retest', description: 'H4 order block retest during the New York open.', rules: ['H4 OB identified', 'M5 BOS', 'Risk ≤ 1%'], createdAt: nowIso() },
  ];
  return { trades, challenges, psych, strategies };
}
