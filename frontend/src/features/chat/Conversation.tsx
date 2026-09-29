import { useEffect, useRef, useState } from 'react';
import { useData } from '../../data/DataContext'; // gives the currnet message state
import { useAuth } from '../../data/AuthContext'; // gives the logged in user id
import { getSocket } from '../../lib/socket'; // gives the shared socket client 

interface Props {
  threadId: string;
  title: string;
  icon: string;
  // Only present for 1:1 friend chats.
  listeningSongTitle?: string | null;
  onJoinListening?: () => void;
  onMenuAction: () => void; // Unfriend or Leave group
  menuLabel: string;
  isPrivateChat: boolean;
  memberNames?: Record<string, string>;
}

export default function Conversation({ threadId, title, icon, listeningSongTitle, onJoinListening, onMenuAction, menuLabel, isPrivateChat, memberNames = {} }: Props) {
  const { db } = useData();
  const [text, setText] = useState('');
  const [groupReady, setGroupReady] = useState(false);
  const [sendError, setSendError] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const messages = db.chats[threadId] || [];

  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.spotifyUserId || !threadId) return;

    const socket = getSocket();

    if (isPrivateChat) {
      const joinPrivateRoom = () => socket.emit('private:join', { otherUserId: threadId });
      socket.on('connect', joinPrivateRoom);
      if (socket.connected) joinPrivateRoom();
      return () => socket.off('connect', joinPrivateRoom);
    }

    setGroupReady(false);
    setSendError('');
    const joinGroupRoom = () => {
      socket.emit('group:join', { groupId: threadId }, (result: { ok: boolean; error?: string }) => {
        setGroupReady(result.ok);
        setSendError(result.ok ? '' : result.error || 'Could not join this group');
      });
    };
    const handleDisconnect = () => setGroupReady(false);

    socket.on('connect', joinGroupRoom);
    socket.on('disconnect', handleDisconnect);
    if (socket.connected) joinGroupRoom();

    return () => {
      socket.off('connect', joinGroupRoom);
      socket.off('disconnect', handleDisconnect);
      socket.emit('group:leave', { groupId: threadId });
    };
  }, [isPrivateChat, profile?.spotifyUserId, threadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  function submit() {
    if (!profile?.spotifyUserId) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    const socket = getSocket();

    if (isPrivateChat) {
      // Private messages still use the accepted-request-gated event.
      socket.emit('private:send', {
        toUserId: threadId,
        text: trimmed,
      });
      setText('');
      return;
    }

    if (!groupReady) {
      setSendError('Join the group before sending messages.');
      return;
    }

    socket.emit('group:send', { groupId: threadId, text: trimmed }, (result: { ok: boolean; error?: string }) => {
      if (!result.ok) {
        setSendError(result.error || 'Could not send group message');
        return;
      }
      setSendError('');
      setText('');
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-cyan-500/20 px-4 py-3">
        <img src={icon} alt={title} className="h-8 w-8 rounded-full object-cover" />
        <span className="font-semibold text-cyan-100">{title}</span>
        {listeningSongTitle && (
          <button
            onClick={onJoinListening}
            type="button"
            className="ml-2 flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200"
          >
            🎧 Listening to {listeningSongTitle}
            <span className="font-semibold text-cyan-300">Join</span>
          </button>
        )}
        <button onClick={onMenuAction} title={menuLabel} type="button" className="ml-auto text-cyan-300/60 hover:text-cyan-200">⋮</button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.from === 'me' ? 'ml-auto bg-[#1ED760] text-black' : 'bg-white/10 text-slate-100'}`}
          >
            {!isPrivateChat && (
              <span className="mb-1 block text-xs opacity-70">
                {m.from === 'me' ? 'You' : memberNames[m.from] ?? m.from}
              </span>
            )}
            <span className="block">{m.text}</span>
            <time className="mt-1 block text-right text-[10px] opacity-60">
              {new Date(m.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </time>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-cyan-500/20 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={`Message ${title}…`}
          className="flex-1 rounded-full border border-cyan-500/20 bg-[#02182b] px-4 py-2 text-sm text-white placeholder:text-slate-500"
        />
        <button onClick={submit} disabled={!isPrivateChat && !groupReady} type="button" className="rounded-full bg-[#1ED760] px-4 py-2 text-sm font-semibold text-black hover:bg-[#1fdf64] disabled:opacity-50">
          Send
        </button>
      </div>
      {sendError && <p role="alert" className="px-4 pb-2 text-xs text-red-400">{sendError}</p>}
    </div>
  );
}
