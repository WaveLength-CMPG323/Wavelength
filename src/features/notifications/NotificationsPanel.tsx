import NavPanel from '../../components/NavPanel';
import { useData } from '../../data/DataContext';

export default function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, resolveNotification } = useData();

  return (
    <NavPanel open={open} onClose={onClose} title="Notifications">
      <div className="flex flex-col gap-3 px-5 py-4">
        {db.notifications.length === 0 && (
          <p className="text-sm text-slate-400">No notifications yet.</p>
        )}

        {db.notifications.map((n) => {
          const user = db.users[n.userId];
          return (
            <div key={n.id} className="flex items-center gap-3">
              <img src={user.pic} alt={user.name} className="h-10 w-10 rounded-full object-cover" />
              {n.status === 'pending' ? (
                <>
                  <span className="flex-1 text-sm text-cyan-100">{user.name} wants to chat with you</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => resolveNotification(n.id, 'accepted')}
                      className="rounded-full bg-[#1ED760] px-3 py-1 text-xs font-semibold text-black"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => resolveNotification(n.id, 'declined')}
                      className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-300"
                    >
                      Decline
                    </button>
                  </div>
                </>
              ) : (
                <span className="text-sm text-slate-500">{user.name} was {n.status}</span>
              )}
            </div>
          );
        })}
      </div>
    </NavPanel>
  );
}
