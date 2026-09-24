import { motion } from 'motion/react';
import { Avatar } from './Avatar';
import { formatStamp } from '../data';
import type { Conversation } from '../types';

interface Props {
  conversations: Conversation[];
  activeId: string;
  query: string;
  onQuery: (q: string) => void;
  onSelect: (id: string) => void;
  onNewGroup: () => void;
  className?: string;
}

export function Sidebar({ conversations, activeId, query, onQuery, onSelect, onNewGroup, className = '' }: Props) {
  const q = query.trim().toLowerCase();
  const shown = conversations.filter((c) => c.name.toLowerCase().includes(q)).sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <aside className={`flex-col border-white/25 md:w-[340px] md:shrink-0 md:border-r ${className}`}>
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-full bg-white">
            <svg viewBox="0 0 24 24" className="size-5" fill="none">
              <path d="M2 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0" stroke="#3d2fb0" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-xl font-semibold text-white">WaveLength</span>
        </div>
        <button
          onClick={onNewGroup}
          className="rounded-full border border-white/40 px-3 py-1 text-xs text-white transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
        >
          New group
        </button>
      </div>

      <div className="px-5 py-4">
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search chats…"
          aria-label="Search chats"
          className="w-full rounded-full bg-white/90 px-4 py-2.5 text-sm text-ink placeholder:text-ink/45 focus-visible:outline-2 focus-visible:outline-white"
        />
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto border-t border-white/20">
        {shown.length === 0 && <li className="px-5 py-8 text-center text-sm text-white/70">No chats match “{query}”.</li>}
        {shown.map((c) => {
          const last = c.messages[c.messages.length - 1];
          const active = c.id === activeId;
          return (
            <motion.li layout="position" key={c.id} className="border-b border-white/15">
              <button
                onClick={() => onSelect(c.id)}
                aria-current={active}
                className="relative flex w-full items-center gap-3 px-5 py-3.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
              >
                {active && (
                  <motion.span layoutId="active-row" className="absolute inset-0 bg-white/18"
                    transition={{ type: 'spring', stiffness: 420, damping: 36 }} />
                )}
                <span className="relative flex w-full items-center gap-3">
                  <Avatar name={c.name} avatar={c.avatar} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">{c.name}</span>
                    <span className="block truncate text-xs text-white/70">
                      {c.typing ? 'typing…' : last ? `${last.from === 'me' ? 'You: ' : ''}${last.text}` : 'No messages yet'}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-[11px] text-white/70">{formatStamp(c.updatedAt)}</span>
                    {c.unread > 0 && (
                      <span className="grid min-w-5 place-items-center rounded-full bg-ink px-1.5 text-[11px] font-medium leading-5 text-white">
                        {c.unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </ul>
    </aside>
  );
}
