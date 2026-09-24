import { Link } from 'react-router-dom';
import {
  Bell,
  LogIn,
  LogOut,
  MessageCircle,
  Search,
  Trophy,
} from 'lucide-react';

import { useData } from '../../data/DataContext';
import { useAuth } from '../../data/AuthContext';

interface Props {
  onSearch: (query: string) => void;
  onOpenNotifications: () => void;
  onOpenChallenge: () => void;
}

export default function OceanNav({
  onSearch,
  onOpenNotifications,
  onOpenChallenge,
}: Props) {
  const { db } = useData();
  const { isLoggedIn, logout } = useAuth();

  const pendingCount = db.notifications.filter(
    (notification) => notification.status === 'pending'
  ).length;

  return (
    <header className="absolute inset-x-0 top-0 z-30 px-5 pt-4">
      <div
        className="
          mx-auto flex min-h-16 w-full
          flex-wrap items-center gap-x-4 gap-y-2
          rounded-2xl border border-white/20
          bg-[#1f2f82]/35 px-5 py-3
          text-white
          shadow-[0_12px_40px_rgba(8,15,55,0.25)]
          backdrop-blur-xl
        "
      >
        {/* LEFT — WaveLength branding */}
        <Link
          to="/"
          aria-label="WaveLength home"
          className="flex shrink-0 items-center gap-3"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M2 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0"
                stroke="#3d2fb0"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="block">
            <p className="text-base font-semibold tracking-wide text-white">
              WaveLength
            </p>

            <p className="text-[11px] text-white/55">
              Discover your sound
            </p>
          </div>
        </Link>

        {/* LEFT — Main navigation */}
        <div className="flex items-center">
          {isLoggedIn && (
            <nav className="flex items-center justify-center gap-1">
              <Link
                to="/chat"
                aria-label="Chat"
                className="
                  relative flex items-center gap-2
                  rounded-full px-3 py-2
                  text-sm font-medium text-white/75
                  transition
                  hover:bg-white/10 hover:text-white
                "
              >
                <MessageCircle className="h-4 w-4 shrink-0" />

                <span className="hidden xl:inline">
                  <span>Chat</span>
                </span>

                {db.hasChatDot && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-400 ring-2 ring-[#283d91]" />
                )}
              </Link>

              <button
                type="button"
                aria-label="Notifications"
                onClick={onOpenNotifications}
                className="
                  relative flex items-center gap-2
                  rounded-full px-3 py-2
                  text-sm font-medium text-white/75
                  transition
                  hover:bg-white/10 hover:text-white
                "
              >
                <Bell className="h-4 w-4 shrink-0" />

                <span className="hidden xl:inline">
                  <span>Notifications</span>
                </span>

                {pendingCount > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-400 ring-2 ring-[#283d91]" />
                )}
              </button>

              <button
                type="button"
                aria-label="Weekly Challenge"
                onClick={onOpenChallenge}
                className="
                  flex items-center gap-2
                  rounded-full border border-white/30
                  bg-white/15 px-3 py-2
                  text-sm font-semibold text-white
                  shadow-sm transition
                  hover:bg-white/25
                  xl:px-4
                "
              >
                <Trophy className="h-4 w-4 shrink-0 text-yellow-200" />

                <span className="hidden lg:inline">
                  Weekly Challenge
                </span>
              </button>
            </nav>
          )}
        </div>

        {/* RIGHT — Search + account */}
        <div className="ml-auto flex min-w-0 items-center justify-end gap-2">
          <div
            className="
              flex min-w-0 items-center gap-2
              rounded-full border border-white/20
              bg-[#091533]/45 px-3 py-2
              transition
              focus-within:border-white/40
              focus-within:bg-[#091533]/60
              xl:px-4
            "
          >
            <Search className="h-4 w-4 shrink-0 text-cyan-200" />

            <input
              type="text"
              placeholder="Search songs or artists"
              aria-label="Search songs or artists"
              onChange={(event) =>
                onSearch(event.target.value)
              }
              className="
                w-24 min-w-0
                bg-transparent text-sm text-white
                outline-none
                placeholder:text-white/40
                lg:w-32 xl:w-48
              "
            />
          </div>

          {isLoggedIn ? (
            <>
              <Link
                to="/profile"
                aria-label="Your profile"
                className="shrink-0"
              >
                <span className="block h-9 w-9 overflow-hidden rounded-full border-2 border-white/60 bg-white/10 transition hover:border-cyan-200">
                  {db.me.pic ? (
                    <img
                      src={db.me.pic}
                      alt="Your profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-white">
                      ME
                    </span>
                  )}
                </span>
              </Link>

              <button
                onClick={logout}
                type="button"
                aria-label="Log out"
                className="
                  flex shrink-0 items-center gap-2
                  rounded-full px-2 py-2
                  text-sm font-medium text-white/65
                  transition
                  hover:bg-white/10 hover:text-white
                  xl:px-3
                "
              >
                <LogOut className="h-4 w-4 shrink-0" />

                <span className="hidden xl:inline">
                  <span>Log out</span>
                </span>
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="flex shrink-0 items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-[#3d2fb0] shadow-sm transition hover:bg-white/90 xl:px-4"
            >
              <LogIn className="h-4 w-4" />

              <span className="hidden sm:inline">
                Log in
              </span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}