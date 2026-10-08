import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, LogOut, MessageCircle, Search, Users } from 'lucide-react';
import { useAuth } from '../../data/AuthContext';
import { useChat } from '../../data/ChatContext';
import { useCosmetics } from '../../data/CosmeticsContext';
import { fetchIncomingChatRequests } from '../../lib/api';
import BorderFrame from '../../components/BorderFrame';
import OceanButton from '../../components/OceanButton';
import BrandLogo from '../../components/BrandLogo';
import Tooltip from '../../components/Tooltip';
import ThemeToggle from '../../components/ThemeToggle';

// A single live search match, as handed down from OceanPage (which owns
// the actual `groups` data) for the search-as-you-type dropdown below.
export interface SearchResultItem {
  trackId: string;
  trackName: string;
  artist: string;
  albumArt: string | null;
  listenerCount: number;
}

interface Props {
  onSearch: (query: string) => void;
  onOpenNotifications: () => void;
  // Matches for whatever's currently in the search box, computed by
  // OceanPage from its live ocean-groups data - with an empty query it's
  // every song currently playing. Rendered as a dropdown while the input
  // is focused.
  searchResults: SearchResultItem[];
  // Clicking a dropdown row does the same thing as clicking that song's
  // bubble on the canvas (opens its OceanSongPanel).
  onSelectSearchResult: (trackId: string) => void;
}

// Same slowed-down idle "bob" used by WeeklyChallengeButton (7.2s, was
// 4.5s there originally) - applied to every button in the nav row too, each
// with its own small delay (derived from index) so they don't all bob in
// perfect unison.
function NavBob({ index, children }: { index: number; children: ReactNode }) {
  return (
    <motion.div
      animate={{ y: [0, -3, 2, -1, 0], rotateZ: [0, 1, -1, 0] }}
      transition={{ repeat: Infinity, duration: 7.2, ease: 'easeInOut', delay: index * 0.6 }}
      className="flex items-center"
    >
      {children}
    </motion.div>
  );
}

export default function OceanNav({ onSearch, onOpenNotifications, searchResults, onSelectSearchResult }: Props) {
  const { isLoggedIn, logout, profile } = useAuth();
  const { hasAnyUnread } = useChat();
  const { equippedEffectCss } = useCosmetics();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  // Local copy of the search text (the input used to be fully
  // uncontrolled) plus whether it's focused - together these decide when
  // the live-results dropdown should be visible: focused AND non-empty.
  // Clicking a result clears both so the dropdown collapses, per the PM's
  // "click a result... then clear/collapse the dropdown" ask.
  const [searchText, setSearchText] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Cycles the search box's placeholder through what it can actually
  // match on, so an empty box hints at the feature set instead of a
  // generic "Search / filter". Only matters while the input is empty -
  // a browser never shows the placeholder once there's real text in it -
  // so this can just run unconditionally rather than pausing/resuming
  // based on focus or content.
  const SEARCH_PLACEHOLDERS = ['Search Artist', 'Search Song', 'Search Genre'];
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % SEARCH_PLACEHOLDERS.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  function handleSearchChange(value: string) {
    setSearchText(value);
    onSearch(value);
  }

  function handleSearchFocus() {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    setSearchFocused(true);
  }

  function handleSearchBlur() {
    // Delay closing so a click on a dropdown row (which blurs the input
    // first) still gets to run its onClick before the dropdown unmounts.
    blurTimerRef.current = setTimeout(() => setSearchFocused(false), 150);
  }

  function handleSelectResult(trackId: string) {
    onSelectSearchResult(trackId);
    setSearchText('');
    onSearch('');
    setSearchFocused(false);
  }

  const hasQuery = searchText.trim() !== '';
  const showDropdown = searchFocused;

  // Real pending chat-request count, for the red dot - polled rather than
  // pushed, so it can lag a few seconds behind an incoming request; fine
  // for a notification badge.
  useEffect(() => {
    if (!isLoggedIn) {
      setPendingCount(0);
      return;
    }
    let cancelled = false;
    function poll() {
      fetchIncomingChatRequests()
        .then((requests) => {
          if (!cancelled) setPendingCount(requests.length);
        })
        .catch(() => {
          // non-fatal - keep showing the last known count
        });
    }
    poll();
    const id = setInterval(poll, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isLoggedIn]);

  return (
    <div className="absolute inset-x-0 top-0 z-30 flex flex-wrap items-center justify-between gap-y-2 gap-x-3 border-b border-cyan-500/20 bg-wl-bg/80 px-3 py-2.5 text-wl-title backdrop-blur sm:px-4">
      {/* Logo + wordmark, far left - the single Wavelength brand mark shown
          to everyone, logged in or not. There used to also be a second,
          smaller logo-only fallback rendered here for guests; it's removed
          so only this one ever shows. The wordmark text itself hides below
          `sm` (see BrandLogo's wordmarkClassName below) - on a narrow phone
          there isn't room for "Wavelength" in text next to the mark AND the
          search box AND the centered icon row without everything crowding
          or overlapping. */}
      <div className="flex items-center gap-2">
        <Link to="/" aria-label="Wavelength home" className="flex items-center gap-2">
          <BrandLogo className="h-7 w-7" withWordmark wordmarkClassName="hidden sm:inline" />
        </Link>
      </div>

      {/* Profile / Chat / Notifications. On `sm` and up there's reliably
          enough room to truly center this group on the nav bar's full
          width via absolute positioning (left-1/2 + -translate-x-1/2)
          rather than a flex-1 middle child - the old flex-1 approach
          centered this group only within whatever space was LEFT OVER
          between the logo and the search/logout controls, which visibly
          wasn't centered since those two side groups aren't the same
          width. Below `sm`, absolute positioning here would instead sit on
          TOP of the logo and/or search box regardless of how little space
          is left - a phone-width nav bar just doesn't have enough spare
          width for a floating center group alongside both side groups. So
          on mobile this becomes a plain, full-width flex child instead
          (`w-full` forces it onto its own wrapped line in the flex-wrap
          container, below the logo/search row), and only switches to the
          absolutely-centered treatment at `sm:`. */}
      {isLoggedIn && (
        <div className="order-last flex w-full items-center justify-center gap-6 sm:order-none sm:w-auto sm:absolute sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:gap-8">
          <NavBob index={0}>
            <Tooltip label="Profile">
              <Link to="/profile" aria-label="Your profile" className="flex items-center">
                <BorderFrame border={equippedEffectCss} shape="circle" className="h-8 w-8">
                  <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-slate-700 ring-2 ring-transparent hover:ring-cyan-400">
                    {profile?.profileImage ? (
                      <img src={profile.profileImage} alt="Your Spotify profile" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-semibold text-slate-300">
                        {(profile?.displayName || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                </BorderFrame>
              </Link>
            </Tooltip>
          </NavBob>

          <NavBob index={1}>
            <Tooltip label="Chat">
              <OceanButton
                onClick={() => navigate('/chat')}
                aria-label="Chat"
                className="relative flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium hover:bg-cyan-500/10 hover:text-wl-title"
              >
                <MessageCircle className="h-5 w-5" />
                {hasAnyUnread && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
              </OceanButton>
            </Tooltip>
          </NavBob>

          <NavBob index={2}>
            <Tooltip label="Notifications">
              <OceanButton
                onClick={onOpenNotifications}
                aria-label="Notifications"
                className="relative flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium hover:bg-cyan-500/10 hover:text-wl-title"
              >
                <Bell className="h-5 w-5" />
                {pendingCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
              </OceanButton>
            </Tooltip>
          </NavBob>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <div className="relative">
          {/* The whole pill (icon + padding, not just the input's own box) focuses
              the input, so clicking anywhere on the search bar opens the list. */}
          <div
            onClick={() => searchInputRef.current?.focus()}
            className="flex cursor-text items-center gap-2 rounded-full border border-cyan-500/20 bg-wl-panel/60 px-3 py-1.5"
          >
            <Search className="h-4 w-4 text-wl-icon" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchText}
              placeholder={SEARCH_PLACEHOLDERS[placeholderIndex]}
              aria-label="Search or filter"
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              className="w-20 bg-transparent text-sm text-wl-title placeholder:text-wl-faint outline-none sm:w-48"
            />
          </div>

          {/* Live results dropdown, Claude.ai-style: shows while the input is
              focused. Empty box = every song currently playing; typing
              narrows it. Each row shows its live listener count. Includes
              an empty-state row so an empty list doesn't just look broken.
              Clicking a row opens that song's panel, same as clicking its
              bubble on the canvas. */}
          {showDropdown && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-40 max-h-80 w-[min(18rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-cyan-500/20 bg-wl-bg/95 shadow-xl backdrop-blur">
              {searchResults.length === 0 ? (
                <p className="px-4 py-3 text-sm text-wl-faint">
                  {hasQuery ? 'No matches' : "No one's listening yet"}
                </p>
              ) : (
                <>
                {!hasQuery && (
                  <p className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-wl-link">
                    Playing now
                  </p>
                )}
                {searchResults.map((result) => (
                  <button
                    key={result.trackId}
                    type="button"
                    onClick={() => handleSelectResult(result.trackId)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-cyan-500/10"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-cyan-950">
                      {result.albumArt ? (
                        <img src={result.albumArt} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Search className="h-3.5 w-3.5 text-cyan-500/50" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-wl-title">{result.trackName}</p>
                      <p className="truncate text-xs text-wl-muted">{result.artist}</p>
                    </div>
                    <span
                      className="flex shrink-0 items-center gap-1 text-xs font-medium text-wl-link"
                      title={`${result.listenerCount} listening`}
                    >
                      <Users className="h-3.5 w-3.5" />
                      {result.listenerCount}
                    </span>
                  </button>
                ))}
                </>
              )}
            </div>
          )}
        </div>

        <Tooltip label="Toggle theme">
          <ThemeToggle />
        </Tooltip>

        {isLoggedIn ? (
          <NavBob index={3}>
            <Tooltip label="Log out">
              <OceanButton
                onClick={logout}
                aria-label="Log out"
                className="flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium text-wl-cyan/70 hover:bg-cyan-500/10 hover:text-wl-title"
              >
                <LogOut className="h-4 w-4" />
              </OceanButton>
            </Tooltip>
          </NavBob>
        ) : (
          <Link to="/login" className="rounded-full bg-wl-accent px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#1fdf64]">
            Log in
          </Link>
        )}
      </div>
    </div>
  );
}
