import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Loader2, MessageSquarePlus, Send, Sparkles, Trash2, User2, Wifi, WifiOff } from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/layout/AppShell';
import { Badge, Button, EmptyState } from '../components/ui';
import { Markdown } from '../components/Markdown';
import { Mascot, SakuraPetals } from '../components/brand';
import { useToast } from '../context/ToastContext';
import { askAi, aiStatus, streamAi } from '../lib/ai/client';
import { SUGGESTED_QUESTIONS } from '../lib/ai/localCoach';

export default function Coach() {
  const { snapshot, createConversation, addMessage, deleteConversation } = useApp();
  const toast = useToast();
  const [convId, setConvId] = useState<string>(snapshot.conversations[0]?.id ?? '');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamed, setStreamed] = useState('');
  const [source, setSource] = useState<string>('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const cfg = useMemo(() => ({
    provider: snapshot.preferences.aiProvider,
    model: snapshot.preferences.aiModel,
    baseUrl: snapshot.preferences.aiBaseUrl,
    temperature: snapshot.preferences.aiTemperature,
  }), [snapshot.preferences]);

  const status = aiStatus(cfg);
  const messages = useMemo(
    () => snapshot.messages.filter((m) => m.conversationId === convId).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [snapshot.messages, convId],
  );

  useEffect(() => {
    // Older WebViews and jsdom may not implement scrollIntoView.
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages.length, streamed]);

  const send = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput('');
    setStreamed('');
    setSource('');
    try {
      let id = convId;
      if (!id) {
        const conv = await createConversation(text.slice(0, 42));
        id = conv.id;
        setConvId(id);
      }
      await addMessage({ conversationId: id, role: 'user', content: text });
      const history = messages.slice(-8).map((m) => ({ role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, content: m.content }));

      let acc = '';
      if (status.source === 'byok') {
        setSource('byok');
        for await (const chunk of streamAi({ question: text, history, trades: snapshot.trades, settings: snapshot.riskSettings, cfg })) {
          acc += chunk;
          setStreamed(acc);
        }
        await addMessage({ conversationId: id, role: 'assistant', content: acc, provider: cfg.model });
      } else {
        const res = await askAi({ question: text, history, trades: snapshot.trades, settings: snapshot.riskSettings, cfg });
        acc = res.text;
        setSource(res.source);
        if (res.warning) toast.error('Provider unavailable', 'Answered with the local statistical engine.');
        await addMessage({ conversationId: id, role: 'assistant', content: acc, provider: res.source });
      }
      setStreamed('');
    } catch (err) {
      toast.error('Coach error', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const newChat = async () => {
    const conv = await createConversation('New conversation');
    setConvId(conv.id);
  };

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col lg:h-[calc(100dvh-6rem)]">
      <PageHeader
        title="AI Trading Coach"
        subtitle="Hiro analyses only your recorded trades — facts and interpretation are always separated."
        badge={status.source === 'local-analysis' ? 'LOCAL ENGINE' : 'AI LIVE'}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/ai-config" className="btn-secondary !py-2 text-xs">
              {status.source === 'local-analysis' ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />} Configure
            </Link>
            <Button size="sm" variant="secondary" onClick={() => void newChat()} icon={<MessageSquarePlus className="h-4 w-4" />}>New</Button>
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[240px_1fr]">
        {/* conversations */}
        <aside className="hidden min-h-0 flex-col rounded-2xl border border-line/70 bg-card/60 p-2 lg:flex">
          <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted/60">Conversations</p>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {snapshot.conversations.map((c) => (
              <div key={c.id} className={clsx('group flex items-center gap-1 rounded-xl px-2 py-2 text-xs', c.id === convId ? 'bg-primary/20 text-ink' : 'text-ink-muted hover:bg-elevated/60')}>
                <button onClick={() => setConvId(c.id)} className="min-w-0 flex-1 truncate text-left">{c.title}</button>
                <button aria-label="Delete conversation" onClick={() => { void deleteConversation(c.id).then(() => { if (c.id === convId) setConvId(''); }); }}
                  className="rounded p-1 opacity-0 hover:text-loss group-hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
            {!snapshot.conversations.length && <p className="px-2 py-6 text-center text-[11px] text-ink-muted">No conversations yet.</p>}
          </div>
          <div className="mt-2 rounded-xl border border-line/60 bg-bg-alt/60 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Engine</p>
            <p className="mt-1 text-[11px] font-medium text-ink">{status.label}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-ink-muted">{status.detail}</p>
          </div>
        </aside>

        {/* chat */}
        <section className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line/70 bg-card/50">
          <SakuraPetals count={6} className="opacity-30" />
          <div className="relative min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
            {!messages.length && !streamed && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Mascot size="lg" />
                <h3 className="mt-4 font-display text-lg font-semibold">Ask Hiro about your trading</h3>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-muted">
                  {status.source === 'local-analysis'
                    ? 'No AI key configured, so answers come from the built-in statistical engine. Every number is computed from your saved trades.'
                    : 'Connected to your configured provider with your trading context attached. Nothing is invented.'}
                </p>
                <div className="mt-4 flex max-w-lg flex-wrap justify-center gap-1.5">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button key={q} onClick={() => void send(q)} className="chip border-line bg-elevated/60 text-ink-muted transition-colors hover:border-primary/50 hover:text-ink">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={clsx('flex gap-2.5', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="mt-0.5 hidden shrink-0 sm:block"><Mascot size="xs" glow={false} /></div>
                )}
                <div className={clsx('max-w-[85%] rounded-2xl px-3.5 py-2.5', msg.role === 'user' ? 'bg-primary/25 text-ink' : 'border border-line/60 bg-bg-alt/70')}>
                  {msg.role === 'assistant' ? <Markdown text={msg.content} /> : <p className="whitespace-pre-wrap text-sm">{msg.content}</p>}
                  {msg.role === 'assistant' && msg.provider && (
                    <p className="mt-2 text-[9px] uppercase tracking-wider text-ink-muted/60">{msg.provider === 'local-analysis' || msg.provider === 'supabase-edge' || msg.provider === 'byok' ? msg.provider.replace('-', ' ') : `model: ${msg.provider}`}</p>
                  )}
                </div>
                {msg.role === 'user' && <div className="mt-0.5 hidden shrink-0 rounded-full bg-elevated p-1.5 sm:grid"><User2 className="h-4 w-4 text-ink-muted" /></div>}
              </div>
            ))}

            {streamed && (
              <div className="flex gap-2.5">
                <div className="mt-0.5 hidden shrink-0 sm:block"><Mascot size="xs" glow={false} /></div>
                <div className="max-w-[85%] rounded-2xl border border-line/60 bg-bg-alt/70 px-3.5 py-2.5">
                  <Markdown text={streamed} />
                  <span className="inline-block h-3 w-1.5 animate-pulse bg-sakura" />
                </div>
              </div>
            )}

            {busy && !streamed && (
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <Loader2 className="h-4 w-4 animate-spin text-primary-neon" />
                Hiro is reviewing your {snapshot.trades.length} recorded trades…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-line/70 bg-bg-alt/60 p-2.5">
            <div className="mb-1.5 flex items-center gap-2 px-1">
              <Badge tone={status.source === 'local-analysis' ? 'warning' : 'profit'}>{status.label}</Badge>
              {source && <span className="text-[10px] text-ink-muted">answered by {source.replace('-', ' ')}</span>}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
                rows={1}
                placeholder="Ask about your performance, mistakes, sessions, risk…"
                className="input max-h-32 flex-1 resize-none py-2.5"
                disabled={busy}
              />
              <Button type="submit" loading={busy} disabled={!input.trim()} className="!px-3.5" aria-label="Send message"><Send className="h-4 w-4" /></Button>
            </form>
            <p className="mt-1 px-1 text-[9px] leading-relaxed text-ink-muted/60">
              Hiro analyses recorded trades only, never executes orders and never guarantees profit. Not financial advice.
            </p>
          </div>
        </section>
      </div>

      {!snapshot.trades.length && (
        <div className="mt-2">
          <EmptyState
            title="The coach needs data"
            description="Log at least one trade (or load the demo dataset) so Hiro has something factual to analyse."
            illustration={<Bot className="h-8 w-8 text-primary-neon" />}
            action={<Link to="/journal/new" className="btn-primary"><Sparkles className="h-4 w-4" /> Log a trade</Link>}
          />
        </div>
      )}
    </div>
  );
}
