import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useChat } from '../../data/ChatContext';
import { useAuth } from '../../data/AuthContext';
import BorderFrame from '../../components/BorderFrame';
import type { RealGroupMember } from '../../data/types';

interface Props {
  threadId: string;
  title: string;
  icon: string | null;
  // Equipped border of the person in a 1:1 thread (groups have none).
  iconBorder?: string | null;
  listeningSongTitle?: string | null;
  onJoinListening?: () => void;
  // System line shown at the very top of the thread, e.g. "You started
  // chatting with Sam" or "You were added to Late Night Lo-fi".
  startNotice?: string;
  onBack?: () => void;
  // Group member roster, passed ONLY for a group thread - used to resolve
  // each message's sender (RealChatMessage.from is just a spotifyUserId)
  // into a displayName/avatar. A 1:1 friend thread leaves this undefined,
  // which keeps that view exactly as before (no per-message sender label -
  // left/right alignment already distinguishes the two speakers there).
  members?: RealGroupMember[];
  // Opens the inline chat profile overlay for a person. Called when the
  // 1:1 header (via onHeaderClick below) or a group message's sender
  // name/avatar is clicked.
  onPersonClick?: (spotifyUserId: string) => void;
  // Makes the header icon/title clickable: opens the friend's profile in a
  // 1:1 thread, or the group's info panel in a group thread.
  onHeaderClick?: () => void;
}

export default function Conversation({
  threadId,
  title,
  icon,
  iconBorder,
  listeningSongTitle,
  onJoinListening,
  startNotice,
  onBack,
  members,
  onPersonClick,
  onHeaderClick,
}: Props) {
  const { messagesFor, sendMessage } = useChat();
  const { profile } = useAuth();
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  const messages = messagesFor(threadId);

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
    <section className="flex h-full min-w-0 flex-1 flex-col bg-wl-panel/55 backdrop-blur-sm">
      {/* Conversation header */}
      <header className="flex items-center gap-3 border-b border-wl-fg/10 bg-wl-panel/45 px-5 py-4 backdrop-blur-md">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to chats"
            className="rounded-full p-1 text-wl-fg/70 transition hover:bg-wl-fg/10 md:hidden"
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

        <BorderFrame border={iconBorder} shape="circle" className="h-11 w-11" reserve="m-4">
          <button
            type="button"
            onClick={onHeaderClick}
            disabled={!onHeaderClick}
            title={onHeaderClick ? (members ? 'View group info' : `View ${title}'s profile`) : undefined}
            className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-slate-700 ${
              onHeaderClick ? 'cursor-pointer transition hover:ring-2 hover:ring-cyan-300/60' : ''
            }`}
          >
            {icon ? (
              <img src={icon} alt={title} className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-semibold text-wl-fg">
                {(title || '?').charAt(0).toUpperCase()}
              </span>
            )}
          </button>
        </BorderFrame>

        <div className="min-w-0">
          <h2
            onClick={onHeaderClick}
            className={`truncate text-base font-semibold text-wl-fg ${onHeaderClick ? 'cursor-pointer hover:underline' : ''}`}
          >
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
            <p className="text-xs text-wl-fg/40">Chat</p>
          )}
        </div>

      </header>

      {/* Messages */}
      <div
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-5"
        aria-live="polite"
      >
        {startNotice && (
          <p className="self-center rounded-full bg-wl-fg/10 px-4 py-1.5 text-center text-xs text-wl-fg/60">
            {startNotice}
          </p>
        )}

        {messages.length === 0 && (
          <p className="m-auto text-sm text-wl-fg/40">
            No messages yet. Say hello to {title}.
          </p>
        )}

        {messages.map((message, index) => {
          const mine = message.from === profile?.spotifyUserId;
          const time = new Date(message.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

          // Group-only: resolve the sender against the member roster, and
          // only show the name/avatar once per consecutive run of messages
          // from the same sender (WhatsApp/Discord-style), never for mine.
          const sender = members?.find((m) => m.spotifyUserId === message.from);
          const senderLabel = sender?.displayName || message.from || 'Former member';
          const prevMessage = index > 0 ? messages[index - 1] : null;
          const showSenderHeader = Boolean(members) && !mine && prevMessage?.from !== message.from;

          function handleSenderClick() {
            if (!mine && onPersonClick) onPersonClick(message.from);
          }

          return (
            <motion.div
              key={message.id}
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
              {showSenderHeader && (
                <button
                  type="button"
                  onClick={handleSenderClick}
                  disabled={!onPersonClick}
                  className={`mb-1 flex items-center gap-1.5 px-1 ${onPersonClick ? 'cursor-pointer hover:opacity-80' : ''}`}
                >
                  <BorderFrame border={sender?.border} shape="circle" className="h-5 w-5" reserve="m-3.5">
                    <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-slate-600">
                      {sender?.profileImage ? (
                        <img src={sender.profileImage} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[9px] font-semibold text-wl-fg">
                          {senderLabel.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                  </BorderFrame>
                  <span className="text-xs font-medium text-wl-link/80">{senderLabel}</span>
                </button>
              )}

              <p
                className={`break-words px-4 py-2.5 text-sm leading-relaxed ${
                  mine
                    ? 'rounded-2xl rounded-br-sm bg-gradient-to-r from-blue-500 to-cyan-400 text-white'
                    : 'rounded-2xl rounded-bl-sm bg-wl-fg/10 text-wl-fg'
                }`}
              >
                {message.text}
              </p>
              <span className="mt-1 px-1 text-[11px] text-wl-fg/35">{time}</span>
            </motion.div>
          );
        })}

        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={submit}
        className="flex items-center gap-3 border-t border-wl-fg/10 bg-wl-panel/45 px-5 py-4 backdrop-blur-md"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${title}…`}
          aria-label={`Message ${title}`}
          maxLength={2000}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-full border border-wl-fg/10 bg-wl-fg/10 px-5 py-3 text-sm text-wl-fg outline-none placeholder:text-wl-fg/40 transition focus:border-cyan-300/60 focus:bg-wl-fg/15"
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