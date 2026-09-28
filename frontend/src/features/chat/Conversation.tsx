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
}

export default function Conversation({ threadId, title, icon, listeningSongTitle, onJoinListening, onMenuAction, menuLabel }: Props) {
  const { db } = useData();
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const messages = db.chats[threadId] || [];

  const { profile } = useAuth();

  // Join the private room for this conversation as soon as the active friend
  // chat is open. The backend will reject the join unless there is an
  // accepted request between the current user and this other user.
  useEffect(() => {
    if (!profile?.spotifyUserId || !threadId) return;

    const socket = getSocket(profile.spotifyUserId);
    socket.emit('private:join', { otherUserId: threadId });
  }, [profile?.spotifyUserId, threadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Use the real Socket.IO event for private chat. The backend validates
    // the accepted-request rule before sending the message.
    const socket = getSocket(profile?.spotifyUserId);

  // Connect the socket to the logged-in Spotify account once the auth profile
  // is loaded. The backend reads this id from socket.handshake.auth.userId so
  // it can authorize private room access and identify the sender.
    if (profile?.spotifyUserId) {
      socket.emit('private:send', {
        toUserId: threadId,
        text: trimmed,
      });
    }
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
            {m.text}
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
        <button onClick={submit} type="button" className="rounded-full bg-[#1ED760] px-4 py-2 text-sm font-semibold text-black hover:bg-[#1fdf64]">
          Send
        </button>
      </div>
    </div>
  );
}
