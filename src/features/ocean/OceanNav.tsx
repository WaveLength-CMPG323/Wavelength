import { Link } from 'react-router-dom';
import { Search, Waves } from 'lucide-react';
import { useData } from '../../data/DataContext';
import { useAuth } from '../../data/AuthContext';

interface Props {
  onSearch: (query: string) => void;
  onOpenNotifications: () => void;
  onOpenChallenge: () => void;
}

export default function OceanNav({ onSearch, onOpenNotifications, onOpenChallenge }: Props) {
  const { db } = useData();
  const { isLoggedIn, logout } = useAuth();
  const pendingCount = db.notifications.filter((n) => n.status === 'pending').length;

  return (
    <div className="absolute inset-x-0 top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 bg-[#02182b]/80 px-4 py-2.5 text-cyan-100 backdrop-blur">
      <div className="flex items-center gap-4">
        {isLoggedIn ? (
          <>
            <Link to="/profile" aria-label="Your profile" className="flex items-center">
              <span className="h-8 w-8 overflow-hidden rounded-full ring-2 ring-transparent hover:ring-cyan-400">
                {db.me.pic && <img src={db.me.pic} alt="Your profile" className="h-full w-full object-cover" />}
              </span>
            </Link>
            <Link to="/chat" className="relative text-sm font-medium hover:text-cyan-300">
              Chat
              {db.hasChatDot && <span className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-red-500" />}
            </Link>
            <button onClick={onOpenNotifications} type="button" className="relative text-sm font-medium hover:text-cyan-300">
              Notifications
              {pendingCount > 0 && <span className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-red-500" />}
            </button>
            <button
              onClick={onOpenChallenge}
              type="button"
              className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
            >
              Weekly Challenge
            </button>
          </>
        ) : (
          <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Waves className="h-5 w-5 text-cyan-400" />
            WaveLength
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-[#04385a]/60 px-3 py-1.5">
          <Search className="h-4 w-4 text-cyan-400" />
          <input
            type="text"
            placeholder="Search / filter"
            aria-label="Search or filter"
            onChange={(e) => onSearch(e.target.value)}
            className="w-32 bg-transparent text-sm text-cyan-100 placeholder:text-cyan-100/40 outline-none sm:w-48"
          />
        </div>

        {isLoggedIn ? (
          <button onClick={logout} type="button" className="text-sm font-medium text-cyan-300/70 hover:text-cyan-200">
            Log out
          </button>
        ) : (
          <Link to="/login" className="rounded-full bg-[#1ED760] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#1fdf64]">
            Log in
          </Link>
        )}
      </div>
    </div>
  );
}
