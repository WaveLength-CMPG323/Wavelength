import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Avatar } from './Avatar';
import type { Conversation } from '../types';

interface Props {
  conversation: Conversation;
  onSend: (text: string) => void;
  onBack: () => void;
  className?: string;
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1" role="status" aria-label="Contact is typing">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="size-1.5 rounded-full bg-white/75"
          animate={{ y: [0, -3, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
      ))}
    </div>
  );
}

export function Thread({ conversation: c, onSend, onBack, className = '' }: Props) {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [c.messages.length, c.typing]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  };

  return (
    <section className={`min-w-0 flex-1 flex-col ${className}`}>
      <header className="flex items-center gap-3 border-b border-white/25 px-5 py-4">
        <button onClick={onBack} aria-label="Back to chats"
          className="rounded-full p-1 text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white md:hidden">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <Avatar name={c.name} avatar={c.avatar} size={42} />
        <div className="min-w-0">
          <h2 className="truncate text-base font-medium text-white">{c.name}</h2>
          <p className="text-xs text-white/75">{c.isGroup ? 'Group chat' : c.online ? 'Online' : 'Offline'}</p>
        </div>
      </header>

      {/* key remounts the list on chat switch so only genuinely new messages animate */}
      <div key={c.id} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-5" aria-live="polite">
        {c.messages.length === 0 && (
          <p className="m-auto text-sm text-white/75">No messages yet. Say hello to {c.name}.</p>
        )}
        <AnimatePresence initial={false}>
          {c.messages.map((m) => {
            const mine = m.from === 'me';
            return (
              <motion.div key={m.id} layout="position"
                initial={{ opacity: 0, y: 10, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                style={{ transformOrigin: mine ? 'bottom right' : 'bottom left' }}
                className={`flex max-w-[78%] flex-col ${mine ? 'items-end self-end' : 'items-start self-start'}`}>
                {c.isGroup && !mine && m.author && <span className="mb-1 px-1 text-[11px] text-white/75">{m.author}</span>}
                <p className={`break-words px-4 py-2.5 text-sm leading-relaxed ${
                  mine ? 'rounded-2xl rounded-br-sm bg-ink text-white' : 'rounded-2xl rounded-bl-sm bg-white/95 text-ink'}`}>
                  {m.text}
                </p>
              </motion.div>
            );
          })}
          {c.typing && (
            <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
              <TypingDots />
              <span className="text-xs text-white/75">{c.name.split(' ')[0]} is typing…</span>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex items-center gap-3 border-t border-white/25 px-5 py-4">
        <input
          value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…" aria-label="Message" maxLength={2000} autoComplete="off"
          className="min-w-0 flex-1 rounded-full bg-white px-5 py-3 text-sm text-ink placeholder:text-ink/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        />
        <motion.button type="submit" disabled={!draft.trim()} whileTap={{ scale: 0.94 }}
          className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          Send
        </motion.button>
      </form>
    </section>
  );
}
