import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  auth, backendMode, loadSnapshot, repo, emptySnapshot, seedDemoData, uid, nowIso,
  type AuthUser, type Snapshot,
} from '../lib/db';
import type {
  AiConversation, AiMessage, ChallengeProfile, JournalNote, MonthlyReport, Notification,
  Profile, PsychologyEntry, RiskSettings, Strategy, Trade, UserPreferences,
} from '../lib/types';
import { DEFAULT_PREFERENCES } from '../lib/db';

interface AppApi {
  ready: boolean;
  user: AuthUser | null;
  mode: 'supabase' | 'local';
  snapshot: Snapshot;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  enterDemo: () => Promise<void>;
  refresh: () => Promise<void>;
  /* trades */
  saveTrade: (t: Trade, isNew?: boolean) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
  duplicateTrade: (id: string) => Promise<Trade | null>;
  /* settings */
  saveRiskSettings: (s: RiskSettings) => Promise<void>;
  savePreferences: (p: UserPreferences) => Promise<void>;
  saveProfile: (p: Partial<Profile>) => Promise<void>;
  /* collections */
  saveChallenge: (c: ChallengeProfile) => Promise<void>;
  deleteChallenge: (id: string) => Promise<void>;
  saveStrategy: (s: Strategy) => Promise<void>;
  deleteStrategy: (id: string) => Promise<void>;
  saveNote: (n: JournalNote) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  savePsych: (p: PsychologyEntry) => Promise<void>;
  saveReport: (r: MonthlyReport) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  addNotification: (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  /* AI */
  createConversation: (title?: string) => Promise<AiConversation>;
  addMessage: (m: Omit<AiMessage, 'id' | 'createdAt'>) => Promise<AiMessage>;
  deleteConversation: (id: string) => Promise<void>;
  /* demo */
  loadDemoData: () => Promise<void>;
  clearAllData: () => Promise<void>;
}

const AppContext = createContext<AppApi | null>(null);

const DEMO_EMAIL = 'demo@segawa.app';
const DEMO_PASSWORD = 'segawa-demo-2024';

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => emptySnapshot({
    id: 'anonymous', email: '', fullName: 'Trader', avatarUrl: null, plan: 'free', createdAt: nowIso(),
  }));
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const pull = useCallback(async (u: AuthUser) => {
    const snap = await loadSnapshot(u);
    if (mounted.current) setSnapshot(snap);
    return snap;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await auth.getSession();
        if (cancelled) return;
        if (session) {
          setUser(session);
          await pull(session);
        }
      } catch (e) {
        console.error('Session restore failed', e);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [pull]);

  const patch = useCallback((fn: (s: Snapshot) => Snapshot) => setSnapshot((s) => fn(s)), []);

  /* ------------------------------ auth ------------------------------ */

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await auth.signIn(email, password);
    setUser(u);
    await pull(u);
  }, [pull]);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const u = await auth.signUp(email, password, fullName);
    setUser(u);
    await pull(u);
    if (backendMode === 'supabase') {
      void repo.saveTable(u.id, 'preferences', { ...DEFAULT_PREFERENCES }, true);
    }
  }, [pull]);

  const signOut = useCallback(async () => {
    await auth.signOut();
    setUser(null);
    setSnapshot(emptySnapshot({ id: 'anonymous', email: '', fullName: 'Trader', avatarUrl: null, plan: 'free', createdAt: nowIso() }));
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!user) return;
    await auth.deleteAccount(user.id);
    setUser(null);
    setSnapshot(emptySnapshot({ id: 'anonymous', email: '', fullName: 'Trader', avatarUrl: null, plan: 'free', createdAt: nowIso() }));
  }, [user]);

  const enterDemo = useCallback(async () => {
    let u = await auth.getSession();
    if (!u) {
      try {
        u = await auth.signIn(DEMO_EMAIL, DEMO_PASSWORD);
      } catch {
        u = await auth.signUp(DEMO_EMAIL, DEMO_PASSWORD, 'Demo Trader');
      }
    }
    setUser(u);
    const snap = await pull(u);
    if (snap.trades.length === 0) {
      const seeded = seedDemoData(u.id);
      await repo.saveAll(u.id, {
        trades: seeded.trades,
        challenges: seeded.challenges,
        psychology: seeded.psych,
        strategies: seeded.strategies,
      });
      await pull(u);
    }
  }, [pull]);

  const refresh = useCallback(async () => {
    if (user) await pull(user);
  }, [user, pull]);

  /* ----------------------------- trades ----------------------------- */

  const saveTrade = useCallback(async (t: Trade, isNew = false) => {
    if (!user) return;
    const trade: Trade = { ...t, userId: user.id, updatedAt: nowIso() };
    await repo.saveTable(user.id, 'trades', trade);
    patch((s) => {
      const exists = s.trades.some((x) => x.id === trade.id);
      const trades = exists ? s.trades.map((x) => (x.id === trade.id ? trade : x)) : [trade, ...s.trades];
      trades.sort((a, b) => +new Date(b.entryTime) - +new Date(a.entryTime));
      return { ...s, trades };
    });
    if (isNew) {
      // Local notification, persisted the same way as any other row.
      const note: Notification = {
        id: uid(), title: 'Trade logged', read: false, createdAt: nowIso(), kind: 'success',
        body: `${trade.instrument} ${trade.direction.toUpperCase()} · ${trade.status === 'closed' ? 'closed' : 'open'} · ${trade.market}`,
        href: `/journal/${trade.id}`,
      };
      await repo.saveTable(user.id, 'notifications', note);
      patch((s) => ({ ...s, notifications: [note, ...s.notifications].slice(0, 100) }));
    }
  }, [user, patch]);

  const deleteTrade = useCallback(async (id: string) => {
    if (!user) return;
    await repo.deleteRow(user.id, 'trades', id);
    patch((s) => ({ ...s, trades: s.trades.filter((t) => t.id !== id) }));
  }, [user, patch]);

  const duplicateTrade = useCallback(async (id: string) => {
    const original = snapshot.trades.find((t) => t.id === id);
    if (!original || !user) return null;
    const copy: Trade = {
      ...original, id: uid(), status: 'open', exitPrice: null, exitTime: null,
      notes: original.notes, screenshots: [], createdAt: nowIso(), updatedAt: nowIso(), entryTime: nowIso(),
    };
    await repo.saveTable(user.id, 'trades', copy);
    patch((s) => ({ ...s, trades: [copy, ...s.trades] }));
    return copy;
  }, [snapshot.trades, user, patch]);

  /* --------------------------- settings ---------------------------- */

  const saveRiskSettings = useCallback(async (s: RiskSettings) => {
    if (!user) return;
    await repo.saveTable(user.id, 'risk_settings', s, true);
    patch((snap) => ({ ...snap, riskSettings: s }));
  }, [user, patch]);

  const savePreferences = useCallback(async (p: UserPreferences) => {
    if (!user) return;
    await repo.saveTable(user.id, 'preferences', p, true);
    patch((snap) => ({ ...snap, preferences: p, riskSettings: { ...snap.riskSettings, accountBalance: snap.riskSettings.accountBalance } }));
  }, [user, patch]);

  const saveProfile = useCallback(async (p: Partial<Profile>) => {
    patch((snap) => ({ ...snap, profile: { ...snap.profile, ...p } }));
    if (user && backendMode === 'supabase') {
      await repo.saveTable(user.id, 'profiles', { id: user.id, ...p } as unknown as { id: string });
    }
  }, [patch, user]);

  /* -------------------------- collections -------------------------- */

  const saveChallenge = useCallback(async (c: ChallengeProfile) => {
    if (!user) return;
    await repo.saveTable(user.id, 'challenges', c);
    patch((s) => ({
      ...s,
      challenges: s.challenges.some((x) => x.id === c.id) ? s.challenges.map((x) => (x.id === c.id ? c : x)) : [...s.challenges, c],
    }));
  }, [user, patch]);

  const deleteChallenge = useCallback(async (id: string) => {
    if (!user) return;
    await repo.deleteRow(user.id, 'challenges', id);
    patch((s) => ({ ...s, challenges: s.challenges.filter((c) => c.id !== id) }));
  }, [user, patch]);

  const saveStrategy = useCallback(async (st: Strategy) => {
    if (!user) return;
    await repo.saveTable(user.id, 'strategies', st);
    patch((s) => ({
      ...s,
      strategies: s.strategies.some((x) => x.id === st.id) ? s.strategies.map((x) => (x.id === st.id ? st : x)) : [...s.strategies, st],
    }));
  }, [user, patch]);

  const deleteStrategy = useCallback(async (id: string) => {
    if (!user) return;
    await repo.deleteRow(user.id, 'strategies', id);
    patch((s) => ({ ...s, strategies: s.strategies.filter((x) => x.id !== id) }));
  }, [user, patch]);

  const saveNote = useCallback(async (n: JournalNote) => {
    if (!user) return;
    await repo.saveTable(user.id, 'notes', n);
    patch((s) => ({
      ...s,
      notes: s.notes.some((x) => x.id === n.id) ? s.notes.map((x) => (x.id === n.id ? n : x)) : [n, ...s.notes],
    }));
  }, [user, patch]);

  const deleteNote = useCallback(async (id: string) => {
    if (!user) return;
    await repo.deleteRow(user.id, 'notes', id);
    patch((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }));
  }, [user, patch]);

  const savePsych = useCallback(async (p: PsychologyEntry) => {
    if (!user) return;
    await repo.saveTable(user.id, 'psychology', p);
    patch((s) => ({
      ...s,
      psychology: s.psychology.some((x) => x.id === p.id) ? s.psychology.map((x) => (x.id === p.id ? p : x)) : [p, ...s.psychology],
    }));
  }, [user, patch]);

  const saveReport = useCallback(async (r: MonthlyReport) => {
    if (!user) return;
    await repo.saveTable(user.id, 'reports', r);
    patch((s) => ({
      ...s,
      reports: s.reports.some((x) => x.id === r.id) ? s.reports.map((x) => (x.id === r.id ? r : x)) : [r, ...s.reports],
    }));
  }, [user, patch]);

  const deleteReport = useCallback(async (id: string) => {
    if (!user) return;
    await repo.deleteRow(user.id, 'reports', id);
    patch((s) => ({ ...s, reports: s.reports.filter((r) => r.id !== id) }));
  }, [user, patch]);

  const addNotification = useCallback(async (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    if (!user) return;
    const row: Notification = { ...n, id: uid(), createdAt: nowIso(), read: false };
    await repo.saveTable(user.id, 'notifications', row);
    patch((s) => ({ ...s, notifications: [row, ...s.notifications].slice(0, 100) }));
  }, [user, patch]);

  const markNotificationsRead = useCallback(async () => {
    if (!user) return;
    const unread = snapshot.notifications.filter((n) => !n.read);
    patch((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
    await Promise.all(unread.map((n) => repo.saveTable(user.id, 'notifications', { ...n, read: true })));
  }, [user, snapshot.notifications, patch]);

  /* ------------------------------ AI ------------------------------- */

  const createConversation = useCallback(async (title = 'New conversation') => {
    const conv: AiConversation = { id: uid(), title, createdAt: nowIso(), updatedAt: nowIso() };
    if (user) await repo.saveTable(user.id, 'conversations', conv);
    patch((s) => ({ ...s, conversations: [conv, ...s.conversations] }));
    return conv;
  }, [user, patch]);

  const addMessage = useCallback(async (m: Omit<AiMessage, 'id' | 'createdAt'>) => {
    const msg: AiMessage = { ...m, id: uid(), createdAt: nowIso() };
    if (user) await repo.saveTable(user.id, 'messages', msg);
    patch((s) => ({ ...s, messages: [...s.messages, msg] }));
    return msg;
  }, [user, patch]);

  const deleteConversation = useCallback(async (id: string) => {
    if (!user) return;
    const msgs = snapshot.messages.filter((m) => m.conversationId === id);
    await Promise.all(msgs.map((m) => repo.deleteRow(user.id, 'messages', m.id)));
    await repo.deleteRow(user.id, 'conversations', id);
    patch((s) => ({
      ...s,
      conversations: s.conversations.filter((c) => c.id !== id),
      messages: s.messages.filter((m) => m.conversationId !== id),
    }));
  }, [user, snapshot.messages, patch]);

  /* ----------------------------- demo ------------------------------ */

  const loadDemoData = useCallback(async () => {
    if (!user) return;
    const seeded = seedDemoData(user.id);
    await repo.saveAll(user.id, {
      trades: seeded.trades, challenges: seeded.challenges, psychology: seeded.psych, strategies: seeded.strategies,
    });
    await pull(user);
  }, [user, pull]);

  const clearAllData = useCallback(async () => {
    if (!user) return;
    await repo.saveAll(user.id, {
      trades: [], challenges: [], psychology: [], strategies: [], notes: [], conversations: [], messages: [],
      reports: [], notifications: [],
    });
    await pull(user);
  }, [user, pull]);

  const api = useMemo<AppApi>(() => ({
    ready, user, mode: backendMode, snapshot,
    signIn, signUp, signOut, deleteAccount, enterDemo, refresh,
    saveTrade, deleteTrade, duplicateTrade,
    saveRiskSettings, savePreferences, saveProfile,
    saveChallenge, deleteChallenge, saveStrategy, deleteStrategy, saveNote, deleteNote, savePsych,
    saveReport, deleteReport, addNotification, markNotificationsRead,
    createConversation, addMessage, deleteConversation,
    loadDemoData, clearAllData,
  }), [
    ready, user, snapshot, signIn, signUp, signOut, deleteAccount, enterDemo, refresh,
    saveTrade, deleteTrade, duplicateTrade, saveRiskSettings, savePreferences, saveProfile,
    saveChallenge, deleteChallenge, saveStrategy, deleteStrategy, saveNote, deleteNote, savePsych,
    saveReport, deleteReport, addNotification, markNotificationsRead, createConversation, addMessage,
    deleteConversation, loadDemoData, clearAllData,
  ]);

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useApp(): AppApi {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

/** Convenience selectors */
export function useTrades(): Trade[] {
  return useApp().snapshot.trades;
}
export function useSettings(): RiskSettings {
  return useApp().snapshot.riskSettings;
}
