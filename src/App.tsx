import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Sidebar } from './components/Sidebar';
import { Thread } from './components/Thread';
import { NewGroupModal } from './components/NewGroupModal';
import { WaveBackground } from './components/WaveBackground';
import { SEED_CONVERSATIONS } from './data';
import type { Conversation } from './types';

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(SEED_CONVERSATIONS);
  const [activeId, setActiveId] = useState<string | null>(null); // nothing open until the user taps a chat
  const [showThread, setShowThread] = useState(false); // mobile only: list vs. thread
  const [showModal, setShowModal] = useState(false);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const update = (id: string, fn: (c: Conversation) => Conversation) =>
    setConversations((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));

  const select = (id: string) => {
    setActiveId(id);
    setShowThread(true);
  };

  // TODO: replace with your API / WebSocket call. This is the single seam for sending text.
  const send = (text: string) => {
    if (!active) return;
    update(active.id, (c) => {
      const sentAt = Date.now();
      return { ...c, updatedAt: sentAt, messages: [...c.messages, { id: crypto.randomUUID(), from: 'me', text, sentAt }] };
    });
  };

  const createGroup = (name: string, presetId: string) => {
    const id = crypto.randomUUID();
    setConversations((cs) => [
      { id, name, isGroup: true, avatar: { kind: 'preset', presetId }, messages: [], updatedAt: Date.now() },
      ...cs,
    ]);
    setShowModal(false);
    select(id);
  };

  return (
    <div className="relative isolate flex h-dvh flex-col bg-brand-cobalt">
      <WaveBackground />

      <header className="flex shrink-0 items-center gap-4 border-b border-white/10 bg-brand-cobalt/50 backdrop-blur-sm px-5 py-4">
        <button
          // TODO: wire this to your router / home route — this project has no home page of its own
          onClick={() => console.log('Navigate to Home')}
          className="flex items-center gap-1.5 text-sm font-medium text-brand-azure hover:text-brand-sky focus-visible:outline-2 focus-visible:outline-brand-sky"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Home
        </button>
        <h1 className="text-base font-semibold text-white">Chat</h1>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar
          className={`${showThread ? 'hidden' : 'flex'} w-full md:flex`}
          conversations={conversations}
          activeId={activeId}
          onSelect={select}
          onNewGroup={() => setShowModal(true)}
        />
        <div className={`${showThread ? 'flex' : 'hidden'} min-w-0 flex-1 md:flex`}>
          {active ? (
            <Thread conversation={active} onSend={send} onBack={() => setShowThread(false)} className="flex" />
          ) : (
            <div className="hidden flex-1 items-center justify-center text-sm text-white/40 md:flex">
              Pick a conversation to get started
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showModal && <NewGroupModal onCreate={createGroup} onClose={() => setShowModal(false)} />}
      </AnimatePresence>
    </div>
  );
}
