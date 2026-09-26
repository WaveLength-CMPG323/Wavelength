import { useState } from 'react';
import { motion } from 'motion/react';
import { Avatar } from './Avatar';
import type { Conversation } from '../types';

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewGroup: () => void;
  className?: string;
}

type Tab = 'friends' | 'groups';

export function Sidebar({ conversations, activeId, onSelect, onNewGroup, className = '' }: Props) {
  const [tab, setTab] = useState<Tab>('friends');
  const shown = conversations
    .filter((c) => (tab === 'groups' ? c.isGroup : !c.isGroup))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <aside className={`flex-col bg-[#0a0e1c] md:w-[320px] md:shrink-0 md:border-r md:border-white/10 ${className}`}>
      <nav className="flex border-b border-white/10 text-sm font-medium">
        {(['friends', 'groups'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative flex-1 py-3.5 capitalize transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-300 ${
              tab === t ? 'text-white' : 'text-white/45 hover:text-white/70'
            }`}
          >
            {t}
            {tab === t && (
              <motion.span
                layoutId="tab-underline"
                className="absolute inset-x-0 bottom-0 h-0.5 bg-teal-400"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        ))}
      </nav>

      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">
          {tab === 'groups' ? 'Your groups' : 'Friends'}
        </span>
        {tab === 'groups' && (
          <button
            onClick={onNewGroup}
            className="rounded-full border border-white/25 px-3 py-1 text-xs text-white/80 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-teal-300"
          >
            New group
          </button>
        )}
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-white/40">
            {tab === 'groups' ? 'No groups yet.' : 'No friends yet.'}
          </li>
        )}
        {shown.map((c) => {
          const active = c.id === activeId;
          const status = c.isGroup
            ? c.messages[c.messages.length - 1]?.text ?? 'Tap to chat'
            : c.listening ?? 'Tap to chat';
          return (
            <li key={c.id}>
              <button
                onClick={() => onSelect(c.id)}
                aria-current={active}
                className={`relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-300 ${
                  active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                }`}
              >
                <Avatar name={c.name} avatar={c.avatar} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-white">{c.name}</span>
                  <span className={`flex items-center gap-1 truncate text-xs ${!c.isGroup && c.listening ? 'text-white/70' : 'text-white/40'}`}>
                    {!c.isGroup && c.listening && <span aria-hidden>🎧</span>}
                    {status}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
