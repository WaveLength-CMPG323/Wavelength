import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useData } from '../../data/DataContext';

interface Props {
  threadId: string;
  title: string;
  icon: string;
  listeningSongTitle?: string | null;
  onJoinListening?: () => void;
  onMenuAction: () => void;
  menuLabel: string;
  onBack?: () => void;
}

export default function Conversation({
  threadId,
  title,
  icon,
  listeningSongTitle,
  onJoinListening,
  onMenuAction,
  menuLabel,
  onBack,
}: Props) {
  const { db, sendMessage } = useData();
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  const messages = db.chats[threadId] || [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function submit(e?: FormEvent) {
    e?.preventDefault();

    const message = text.trim();
    if (!message) return;

    sendMessage(threadId, message);
    setText('');
  }

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-[#071c3d]/55 backdrop-blur-sm">
      {/* Conversation header */}
      <header className="flex items-center gap-3 border-b border-white/10 bg-[#071c3d]/45 px-5 py-4 backdrop-blur-md">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to chats"
            className="rounded-full p-1 text-white/70 transition hover:bg-white/10 md:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}

        <img
          src={icon}
          alt={title}
          className="h-11 w-11 shrink-0 rounded-full object-cover"
        />

        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-white">
            {title}
          </h2>

          {listeningSongTitle ? (
            <button
              type="button"
              onClick={onJoinListening}
              className="mt-0.5 flex max-w-full items-center gap-1 truncate text-xs text-cyan-200 transition hover:text-cyan-100"
            >
              <span aria-hidden>🎧</span>
              <span className="truncate">
                Listening to {listeningSongTitle}
              </span>
              <span className="font-semibold text-cyan-300">Join</span>
            </button>
          ) : (
            <p className="text-xs text-white/40">Chat</p>
          )}
        </div>

        <button
          type="button"
          onClick={onMenuAction}
          title={menuLabel}
          aria-label={menuLabel}
          className="ml-auto rounded-full px-3 py-2 text-xl leading-none text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          ⋮
        </button>
      </header>

      {/* Messages */}
      <div
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-5"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <p className="m-auto text-sm text-white/40">
            No messages yet. Say hello to {title}.
          </p>
        )}

        {messages.map((message, index) => {
          const mine = message.from === 'me';

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 34,
              }}
              className={`flex max-w-[78%] flex-col ${
                mine
                  ? 'items-end self-end'
                  : 'items-start self-start'
              }`}
            >
              <p
                className={`break-words px-4 py-2.5 text-sm leading-relaxed ${
                  mine
                    ? 'rounded-2xl rounded-br-sm bg-gradient-to-r from-blue-500 to-cyan-400 text-white'
                    : 'rounded-2xl rounded-bl-sm bg-white/10 text-white'
                }`}
              >
                {message.text}
              </p>
            </motion.div>
          );
        })}

        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={submit}
        className="flex items-center gap-3 border-t border-white/10 bg-[#071c3d]/45 px-5 py-4 backdrop-blur-md"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${title}…`}
          aria-label={`Message ${title}`}
          maxLength={2000}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm text-white outline-none placeholder:text-white/40 transition focus:border-cyan-300/60 focus:bg-white/15"
        />

        <motion.button
          type="submit"
          disabled={!text.trim()}
          whileTap={{ scale: 0.94 }}
          className="rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </motion.button>
      </form>
    </section>
  );
}