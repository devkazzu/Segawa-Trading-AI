export type Market = 'forex' | 'indices' | 'commodities' | 'crypto' | 'stocks';
export type Direction = 'buy' | 'sell';
export type TradeStatus = 'open' | 'closed';
export type Session = 'Asian' | 'London' | 'London/NY Overlap' | 'New York' | 'Sydney';

export interface Trade {
  id: string;
  userId: string;
  accountId: string | null;
  instrument: string;
  market: Market;
  direction: Direction;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  lotSize: number;
  quantity: number;
  contractSize: number;
  tickSize: number;
  tickValue: number;
  currency: string;
  entryTime: string;
  exitTime: string | null;
  session: Session;
  timeframe: string;
  strategy: string;
  setup: string;
  riskPercent: number;
  commission: number;
  swap: number;
  spread: number;
  fees: number;
  status: TradeStatus;
  screenshots: Screenshot[];
  notes: string;
  emotions: string[];
  ruleChecklist: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface Screenshot {
  id: string;
  name: string;
  /** data URL (demo mode) or public storage URL (Supabase) */
  url: string;
  createdAt: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  rules: string[];
  createdAt: string;
}

export interface RiskSettings {
  accountBalance: number;
  maxRiskPerTrade: number;
  dailyLossLimit: number;
  weeklyLossLimit: number;
  maxDrawdown: number;
  dailyTradeLimit: number;
  consecutiveLossAlert: number;
  defaultContractSize: number;
  defaultTickSize: number;
  defaultTickValue: number;
  riskPerTradeMode: 'percent' | 'fixed';
  fixedRiskAmount: number;
}

export interface ChallengeProfile {
  id: string;
  name: string;
  firm: string;
  startingBalance: number;
  currentBalance: number;
  profitTargetPct: number;
  dailyDrawdownPct: number;
  overallDrawdownPct: number;
  phase: string;
  tradingDays: number;
  minTradingDays: number;
  startDate: string;
  status: 'active' | 'passed' | 'failed' | 'archived';
  notes: string;
}

export interface PsychologyEntry {
  id: string;
  date: string;
  emotions: string[];
  mood: number;
  discipline: number;
  stress: number;
  note: string;
  createdAt: string;
}

export interface JournalNote {
  id: string;
  date: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
}

export interface AiMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  provider?: string;
  tokens?: number;
}

export interface AiConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyReport {
  id: string;
  period: string;
  title: string;
  summary: string;
  metrics: Record<string, number | string>;
  findings: Finding[];
  recommendations: string[];
  source: 'ai' | 'local-analysis';
  createdAt: string;
}

export interface Finding {
  id: string;
  title: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  frequency: number;
  tradeIds: string[];
  evidence: string;
  impact: number;
  explanation: string;
  correction: string;
  verified: boolean;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  kind: 'info' | 'warning' | 'success' | 'risk';
  read: boolean;
  createdAt: string;
  href?: string;
}

export interface UserPreferences {
  aiProvider: string;
  aiModel: string;
  aiBaseUrl: string;
  aiTemperature: number;
  currency: string;
  timezone: string;
  startingBalance: number;
  defaultInstrument: string;
  defaultRiskPercent: number;
  compactMode: boolean;
  mascotEnabled: boolean;
}

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  plan: 'free' | 'pro';
  createdAt: string;
}

export interface DateRange { from: string | null; to: string | null; label: string; }

export type PageKey =
  | 'dashboard' | 'journal' | 'analytics' | 'coach' | 'audit' | 'risk' | 'strategy'
  | 'psychology' | 'challenge' | 'reports' | 'notifications' | 'profile' | 'settings' | 'ai-config';
