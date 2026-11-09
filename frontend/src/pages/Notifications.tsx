import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info, ShieldAlert, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/layout/AppShell';
import { Button, EmptyState, Tabs } from '../components/ui';
import { fmtDateTime } from '../lib/calc';

export default function Notifications() {
  const { snapshot, markNotificationsRead } = useApp();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const rows = useMemo(
    () => snapshot.notifications.filter((n) => (tab === 'all' ? true : !n.read)),
    [snapshot.notifications, tab],
  );
  const unread = snapshot.notifications.filter((n) => !n.read).length;

  const icon = (kind: string) => {
    if (kind === 'warning' || kind === 'risk') return <ShieldAlert className="h-4 w-4 text-sakura" />;
    if (kind === 'success') return <CheckCircle2 className="h-4 w-4 text-profit" />;
    return <Info className="h-4 w-4 text-primary-neon" />;
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : 'You are all caught up'}
        actions={<Button size="sm" variant="secondary" onClick={() => void markNotificationsRead()} disabled={!unread} icon={<CheckCheck className="h-4 w-4" />}>Mark all read</Button>}
      />

      <Tabs className="mb-3" value={tab} onChange={setTab} tabs={[{ value: 'all', label: `All (${snapshot.notifications.length})` }, { value: 'unread', label: `Unread (${unread})` }]} />

      {!rows.length ? (
        <EmptyState illustration={<Bell className="h-8 w-8 text-primary-neon" />} title="No notifications" description="Trade confirmations, risk-limit alerts and report events will appear here." />
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <div key={n.id} className={clsx('card flex items-start gap-3 !p-3.5', !n.read && 'border-primary/40')}>
              <div className="mt-0.5 rounded-lg bg-elevated p-1.5">{icon(n.kind)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{n.title}</p>
                  {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-sakura" />}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{n.body}</p>
                <p className="mt-1 text-[10px] text-ink-muted/60">{fmtDateTime(n.createdAt)}</p>
                {n.href && <Link to={n.href} className="mt-1 inline-block text-[11px] font-semibold text-primary-neon hover:underline">Open →</Link>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-line/60 bg-card/50 p-3 text-[11px] leading-relaxed text-ink-muted">
        <AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-sakura" />
        Risk alerts are generated locally from your configured limits. They are informational and do not block order execution — Segawa never places trades.
        <span className="ml-1 inline-flex items-center gap-1"><Trash2 className="h-3 w-3" /> Notifications older than the newest 100 are trimmed automatically.</span>
      </div>
    </div>
  );
}
