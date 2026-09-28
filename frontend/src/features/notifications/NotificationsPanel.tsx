import { useEffect, useState } from 'react';
import NavPanel from '../../components/NavPanel';
import { fetchIncomingChatRequests, respondToChatRequest } from '../../lib/api';
import type { ChatRequest } from '../../data/types';

// Real chat requests, addressed to your actual Spotify account (see
// backend/lib/chatRequests.js) - not the mock db.notifications this used
// to read from. Chat itself isn't built yet: Accept/Decline here only
// resolves the request, it doesn't open a conversation.
export default function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [requests, setRequests] = useState<ChatRequest[]>([]);
  const [error, setError] = useState('');
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetchIncomingChatRequests()
      .then(setRequests)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load notifications'));
  }, [open]);

  async function respond(id: string, accept: boolean) {
    setError('');
    setRespondingId(id);
    try {
      await respondToChatRequest(id, accept);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not respond to chat request');
    } finally {
      setRespondingId(null);
    }
  }

  return (
    <NavPanel open={open} onClose={onClose} title="Notifications">
      <div className="flex flex-col gap-3 px-5 py-4">
        {error && <p className="text-sm text-red-400">{error}</p>}

        {requests.length === 0 && !error && (
          <p className="text-sm text-slate-400">No notifications yet.</p>
        )}

        {requests.map((r) => (
          <div key={r.id} className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700">
              {r.fromProfileImage ? (
                <img src={r.fromProfileImage} alt={r.fromDisplayName ?? ''} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-semibold text-slate-300">
                  {(r.fromDisplayName || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="flex-1 text-sm text-cyan-100">
              {r.fromDisplayName || 'Someone'} wants to chat with you
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => respond(r.id, true)}
                disabled={respondingId === r.id}
                type="button"
                className="rounded-full bg-[#1ED760] px-3 py-1 text-xs font-semibold text-black disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => respond(r.id, false)}
                disabled={respondingId === r.id}
                type="button"
                className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-300 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </NavPanel>
  );
}
