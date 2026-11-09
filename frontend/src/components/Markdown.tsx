import { Fragment, useMemo, type ReactNode } from 'react';
import { clsx } from 'clsx';

/** Minimal, dependency-free markdown renderer for AI responses. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith('**')) parts.push(<strong key={key} className="font-semibold text-ink">{token.slice(2, -2)}</strong>);
    else if (token.startsWith('`')) parts.push(<code key={key} className="rounded bg-elevated px-1 py-0.5 font-mono text-[0.85em] text-primary-neon">{token.slice(1, -1)}</code>);
    else parts.push(<em key={key} className="italic text-ink/90">{token.slice(1, -1)}</em>);
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => {
    const lines = text.replace(/\r/g, '').split('\n');
    const out: ReactNode[] = [];
    let list: string[] = [];
    let table: string[] = [];
    let key = 0;

    const flushList = () => {
      if (!list.length) return;
      out.push(
        <ul key={`ul-${key++}`} className="my-2 space-y-1.5 pl-1">
          {list.map((li, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink/90">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
              <span>{inline(li, `li-${i}`)}</span>
            </li>
          ))}
        </ul>,
      );
      list = [];
    };

    const flushTable = () => {
      if (!table.length) return;
      const rows = table.filter((r) => !/^\|?[\s:-|]+\|?$/.test(r)).map((r) => r.split('|').slice(1, -1).map((c) => c.trim()));
      if (rows.length) {
        const [head, ...body] = rows;
        out.push(
          <div key={`tbl-${key++}`} className="my-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated/70">
                <tr>{head.map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2 font-semibold text-ink-muted">{h}</th>)}</tr>
              </thead>
              <tbody>
                {body.map((r, ri) => (
                  <tr key={ri} className="border-t border-line/50">
                    {r.map((c, ci) => <td key={ci} className="whitespace-nowrap px-3 py-2 tabular-nums text-ink/90">{inline(c, `td-${ri}-${ci}`)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
      table = [];
    };

    for (const raw of lines) {
      const line = raw.trimEnd();
      if (/^\|.*\|$/.test(line)) { flushList(); table.push(line); continue; }
      if (table.length) flushTable();
      if (!line.trim()) { flushList(); continue; }
      if (/^#{1,4}\s/.test(line)) {
        flushList();
        const level = (line.match(/^#+/) ?? ['#'])[0].length;
        const content = inline(line.replace(/^#+\s*/, ''), `h-${key}`);
        const cls = level <= 2 ? 'mt-4 text-base' : 'mt-3 text-sm';
        out.push(<h4 key={`h-${key++}`} className={clsx('font-display font-semibold text-ink', cls)}>{content}</h4>);
        continue;
      }
      if (/^[-*]\s/.test(line)) { list.push(line.replace(/^[-*]\s+/, '')); continue; }
      if (/^>\s/.test(line)) {
        flushList();
        out.push(
          <p key={`q-${key++}`} className="my-2 rounded-lg border-l-2 border-primary/60 bg-primary/5 px-3 py-2 text-xs italic text-ink-muted">
            {inline(line.replace(/^>\s*/, ''), `q-${key}`)}
          </p>,
        );
        continue;
      }
      if (/^---+$/.test(line)) { flushList(); out.push(<hr key={`hr-${key++}`} className="my-3 border-line" />); continue; }
      if (/^\d+\.\s/.test(line)) { list.push(line.replace(/^\d+\.\s+/, '')); continue; }
      flushList();
      out.push(<p key={`p-${key++}`} className="my-1.5 text-sm leading-relaxed text-ink/90">{inline(line, `p-${key}`)}</p>);
    }
    flushList();
    flushTable();
    return out;
  }, [text]);

  return <div className={className}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
