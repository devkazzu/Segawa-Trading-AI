import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, Bell, Bot, Brain, ChevronRight, ClipboardList, FileText, Gauge, Grid2x2, LayoutDashboard,
  LogOut, Menu, NotebookPen, Plus, Settings, Shield, Sparkles, Target, Trophy, User, X, Zap,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '../../context/AppContext';
import { Logo, Mascot } from '../brand';
import { Badge } from '../ui';

export interface NavItem { to: string; label: string; icon: typeof LayoutDashboard; group: 'trade' | 'intelligence' | 'account' }

export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, group: 'trade' },
  { to: '/journal', label: 'Trade Journal', icon: NotebookPen, group: 'trade' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, group: 'trade' },
  { to: '/risk', label: 'Risk Management', icon: Shield, group: 'trade' },
  { to: '/challenge', label: 'Challenge Tracker', icon: Trophy, group: 'trade' },
  { to: '/coach', label: 'AI Coach', icon: Bot, group: 'intelligence' },
  { to: '/audit', label: 'Monthly Audit', icon: Gauge, group: 'intelligence' },
  { to: '/strategy', label: 'Strategy Analysis', icon: Target, group: 'intelligence' },
  { to: '/psychology', label: 'Psychology', icon: Brain, group: 'intelligence' },
  { to: '/reports', label: 'Reports', icon: FileText, group: 'intelligence' },
  { to: '/notifications', label: 'Notifications', icon: Bell, group: 'account' },
  { to: '/profile', label: 'Profile', icon: User, group: 'account' },
  { to: '/settings', label: 'Settings', icon: Settings, group: 'account' },
  { to: '/ai-config', label: 'AI Configuration', icon: Sparkles, group: 'account' },
];

const GROUP_LABEL: Record<NavItem['group'], string> = { trade: 'Trading', intelligence: 'Intelligence', account: 'Account' };

export function AppShell() {
  const { snapshot, signOut, mode } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const [more, setMore] = useState(false);
  const unread = snapshot.notifications.filter((n) => !n.read).length;

  useEffect(() => { setDrawer(false); setMore(false); window.scrollTo({ top: 0 }); }, [location.pathname]);

  // Two tabs left of the centre AI action, one right, plus "More".
  const bottomItems = useMemo(() => NAV.filter((n) => ['/', '/journal', '/analytics'].includes(n.to)), []);
  const isActive = (to: string) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to));

  return (
    <div className="min-h-[100dvh]">
      {/* ---------------- desktop sidebar ---------------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line/70 bg-bg-alt/80 backdrop-blur-xl lg:flex">
        <div className="flex items-center justify-between px-5 py-5">
          <Link to="/" aria-label="Segawa TradeAI home"><Logo /></Link>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {(['trade', 'intelligence', 'account'] as const).map((g) => (
            <div key={g}>
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted/60">{GROUP_LABEL[g]}</p>
              <div className="space-y-0.5">
                {NAV.filter((n) => n.group === g).map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive: a }) => clsx('nav-link', a && 'nav-link-active')}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.to === '/notifications' && unread > 0 && (
                      <span className="ml-auto rounded-full bg-sakura px-1.5 py-0.5 text-[10px] font-bold text-[#2a0b1c]">{unread}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-line/70 p-3">
          <div className="mb-2 rounded-2xl border border-line/60 bg-card/70 p-3">
            <div className="flex items-center gap-2">
              <Mascot size="xs" glow={false} />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{snapshot.profile.fullName || 'Trader'}</p>
                <p className="truncate text-[10px] text-ink-muted">{mode === 'local' ? 'Local demo mode' : 'Supabase connected'}</p>
              </div>
            </div>
          </div>
          <button onClick={() => void signOut().then(() => navigate('/login'))} className="nav-link w-full text-left">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* ---------------- main column ---------------- */}
      <div className="lg:pl-64">
        <header className="safe-top sticky top-0 z-30 border-b border-line/60 bg-bg/80 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button className="rounded-xl border border-line p-2 text-ink-muted lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <div className="lg:hidden"><Logo compact /></div>
            <div className="hidden min-w-0 flex-1 lg:block">
              <p className="truncate text-sm text-ink-muted">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link to="/journal/new" className="btn-primary hidden !px-3.5 !py-2 text-xs sm:inline-flex">
                <Plus className="h-4 w-4" /> Add trade
              </Link>
              <Link to="/notifications" className="relative rounded-xl border border-line bg-elevated/60 p-2 text-ink-muted hover:text-ink" aria-label={`Notifications (${unread} unread)`}>
                <Bell className="h-5 w-5" />
                {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-sakura px-1 text-[9px] font-bold text-[#2a0b1c]">{unread > 9 ? '9+' : unread}</span>}
              </Link>
              <Link to="/profile" className="overflow-hidden rounded-full ring-2 ring-primary/40" aria-label="Profile">
                <Mascot size="xs" glow={false} />
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto px-4 pb-2 lg:hidden">
            {NAV.filter((n) => ['/audit', '/risk', '/challenge', '/strategy', '/psychology', '/reports'].includes(n.to)).map((n) => (
              <Link key={n.to} to={n.to} className={clsx('chip shrink-0', isActive(n.to) ? 'border-primary/50 bg-primary/20 text-primary-neon' : 'border-line bg-elevated/50 text-ink-muted')}>
                <n.icon className="h-3 w-3" /> {n.label}
              </Link>
            ))}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:pb-10">
          <Outlet />
        </main>
      </div>

      {/* ---------------- mobile bottom nav ---------------- */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-bg-alt/95 backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-5 items-end">
          {bottomItems.slice(0, 2).map((item) => (
            <Link key={item.to} to={item.to} className={clsx('flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium', isActive(item.to) ? 'text-primary-neon' : 'text-ink-muted')}>
              <item.icon className={clsx('h-5 w-5', isActive(item.to) && 'drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]')} />
              {item.label.replace('Trade ', '')}
            </Link>
          ))}

          {/* centre AI action, as in the Segawa design language */}
          <Link to="/coach" aria-label="AI Coach" className="relative flex flex-col items-center pb-1.5">
            <span className={clsx(
              'grid h-14 w-14 -translate-y-4 place-items-center rounded-full bg-btn-primary text-[#17091f] shadow-glow ring-4 ring-bg',
              isActive('/coach') && 'animate-pulse-glow',
            )}>
              <Sparkles className="h-6 w-6" />
            </span>
            <span className={clsx('-mt-2 text-[10px] font-semibold', isActive('/coach') ? 'text-primary-neon' : 'text-ink-muted')}>AI</span>
          </Link>

          {bottomItems.slice(2).map((item) => (
            <Link key={item.to} to={item.to} className={clsx('flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium', isActive(item.to) ? 'text-primary-neon' : 'text-ink-muted')}>
              <item.icon className={clsx('h-5 w-5', isActive(item.to) && 'drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]')} />
              {item.label.replace('Trade ', '')}
            </Link>
          ))}

          <button onClick={() => setMore(true)} className={clsx('flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium', more ? 'text-primary-neon' : 'text-ink-muted')}>
            <Grid2x2 className="h-5 w-5" /> More
          </button>
        </div>
      </nav>

      {/* ---------------- mobile drawer ---------------- */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col border-r border-line bg-bg-alt">
            <div className="flex items-center justify-between border-b border-line/60 px-4 py-4">
              <Logo />
              <button onClick={() => setDrawer(false)} aria-label="Close menu" className="rounded-lg p-1.5 text-ink-muted"><X className="h-5 w-5" /></button>
            </div>
            <nav className="flex-1 space-y-4 overflow-y-auto p-3">
              {(['trade', 'intelligence', 'account'] as const).map((g) => (
                <div key={g}>
                  <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted/60">{GROUP_LABEL[g]}</p>
                  {NAV.filter((n) => n.group === g).map((item) => (
                    <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive: a }) => clsx('nav-link', a && 'nav-link-active')}>
                      <item.icon className="h-4 w-4" /> {item.label}
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>
            <div className="border-t border-line/60 p-3">
              <button onClick={() => void signOut().then(() => navigate('/login'))} className="nav-link w-full"><LogOut className="h-4 w-4" /> Sign out</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- mobile "more" sheet ---------------- */}
      {more && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMore(false)} />
          <div className="safe-bottom absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line bg-bg-alt p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-sm font-semibold">All modules</p>
              <button onClick={() => setMore(false)} aria-label="Close" className="rounded-lg p-1.5 text-ink-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {NAV.map((item) => (
                <Link key={item.to} to={item.to} className={clsx('flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-[11px] font-medium', isActive(item.to) ? 'border-primary/50 bg-primary/15 text-primary-neon' : 'border-line bg-card text-ink-muted')}>
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, badge }: { title: string; subtitle?: string; actions?: React.ReactNode; badge?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          {badge && <Badge tone="primary"><Zap className="h-3 w-3" />{badge}</Badge>}
        </div>
        {subtitle && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Crumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <div className="mb-3 flex items-center gap-1 overflow-x-auto text-xs text-ink-muted">
      {items.map((it, i) => (
        <span key={i} className="flex shrink-0 items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 opacity-50" />}
          {it.to ? <Link to={it.to} className="hover:text-ink">{it.label}</Link> : <span className="text-ink">{it.label}</span>}
        </span>
      ))}
    </div>
  );
}

export const IconFor = { ClipboardList, Bot, Gauge };
