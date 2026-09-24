import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Sidebar } from './components/Sidebar';
import { Thread } from './components/Thread';
import { NewGroupModal } from './components/NewGroupModal';
import { SEED_CONVERSATIONS } from './data';
import type { Conversation } from './types';

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(SEED_CONVERSATIONS);
  const [activeId, setActiveId] = useState(SEED_CONVERSATIONS[0].id);
  const [query, setQuery] = useState('');
  const [showThread, setShowThread] = useState(false); // mobile only: list vs. thread
  const [showModal, setShowModal] = useState(false);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];
  const update = (id: string, fn: (c: Conversation) => Conversation) =>
    setConversations((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));

  const select = (id: string) => {
    setActiveId(id);
    setShowThread(true);
    update(id, (c) => ({ ...c, unread: 0 }));
  };

  // TODO: replace with your API / WebSocket call. This is the single seam for sending text.
  const send = (text: string) =>
    update(active.id, (c) => {
      const sentAt = Date.now();
      return { ...c, updatedAt: sentAt, messages: [...c.messages, { id: crypto.randomUUID(), from: 'me', text, sentAt }] };
    });

  const createGroup = (name: string, presetId: string) => {
    const id = crypto.randomUUID();
    setConversations((cs) => [
      { id, name, isGroup: true, avatar: { kind: 'preset', presetId }, messages: [], unread: 0, updatedAt: Date.now() },
      ...cs,
    ]);
    setShowModal(false);
    select(id);
  };

  return (
    <main className="h-dvh bg-linear-to-br from-wl-indigo via-wl-violet via-30% to-wl-teal p-0 md:p-8">
      <div className="mx-auto flex h-full max-w-6xl overflow-hidden border-white/35 bg-ink/35 shadow-[0_20px_45px_rgba(10,15,45,0.35)] backdrop-blur-md md:rounded-3xl md:border">
        <Sidebar
          className={`${showThread ? 'hidden' : 'flex'} w-full md:flex`}
          conversations={conversations} activeId={active.id} query={query}
          onQuery={setQuery} onSelect={select} onNewGroup={() => setShowModal(true)}
        />
        <Thread
          className={`${showThread ? 'flex' : 'hidden'} md:flex`}
          conversation={active} onSend={send} onBack={() => setShowThread(false)}
        />
      </div>
      <AnimatePresence>
        {showModal && <NewGroupModal onCreate={createGroup} onClose={() => setShowModal(false)} />}
      </AnimatePresence>
    </main>
  );
}
