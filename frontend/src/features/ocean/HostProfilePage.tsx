import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ExternalLink, MessageCircle } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../data/AuthContext';
import { fetchHostProfile, sendChatRequest } from '../../lib/api';
import type { HostProfile } from '../../data/types';

// A read-only Wavelength profile for someone else - reached by clicking
// "View Profile" on an ocean song panel for a host who isn't you. Shows
// their name, avatar, and Spotify profile link - the only things we can
// still get for a third party. No editing (it's not your profile), no
// nickname/bio/genres (that's mock app-only state that only exists for
// whoever is currently logged in as "me" - see MyProfilePage).
//
// There's no playlists or recently-played section here: Spotify removed
// GET /users/{id}/playlists entirely in their February 2026 Web API
// changes, and recently-played was never available for anyone but the
// authenticated user themselves. This page shows what's still possible -
// name and avatar, sourced from OUR OWN copy of that data (captured when
// they themselves logged into Wavelength), not a live Spotify lookup.
//
// "Request Chat" sends a real request to their Spotify account, which
// shows up in their Notifications to accept or decline - see
// backend/lib/chatRequests.js. Chat itself isn't built yet; this only
// covers the request/accept/decline step.
export default function HostProfilePage() {
  const { spotifyUserId } = useParams<{ spotifyUserId: string }>();
  const { profile: myProfile } = useAuth();
  const [profile, setProfile] = useState<HostProfile | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [chatRequestState, setChatRequestState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [chatRequestError, setChatRequestError] = useState('');

  useEffect(() => {
    if (!spotifyUserId) return;
    setLoading(true);
    setError('');
    setChatRequestState('idle');
    fetchHostProfile(spotifyUserId)
      .then(({ profile }) => setProfile(profile))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load this profile'))
      .finally(() => setLoading(false));
  }, [spotifyUserId]);

  const isMe = !!myProfile && myProfile.spotifyUserId === spotifyUserId;

  async function handleRequestChat() {
    if (!spotifyUserId) return;
    setChatRequestState('sending');
    setChatRequestError('');
    try {
      await sendChatRequest(spotifyUserId);
      setChatRequestState('sent');
    } catch (err) {
      setChatRequestState('error');
      setChatRequestError(err instanceof Error ? err.message : 'Could not send chat request');
    }
  }

  return (
    <div className="min-h-screen bg-wl-bg pb-24 text-wl-fg">
      <PageHeader title={profile?.displayName || 'Profile'} />

      <div className="mx-auto my-8 max-w-4xl rounded-3xl border border-cyan-500/20 bg-wl-panel/90 p-6 shadow-2xl backdrop-blur-md md:p-8">
        {loading ? (
          <p className="text-sm text-wl-muted">Loading…</p>
        ) : error ? (
          <p className="text-sm text-wl-danger">{error}</p>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-cyan-400 bg-slate-300 shadow-md">
              {profile?.profileImage ? (
                <img src={profile.profileImage} alt={profile.displayName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-semibold text-slate-700">
                  {(profile?.displayName || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-lg font-semibold text-wl-title">{profile?.displayName}</p>
              {profile?.profileUrl && (
                <a
                  href={profile.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-wl-link underline hover:text-wl-cyan"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open Spotify profile
                </a>
              )}
            </div>

            {!isMe && (
              <div className="flex flex-col items-center gap-1 sm:items-end">
                <button
                  onClick={handleRequestChat}
                  disabled={chatRequestState === 'sending' || chatRequestState === 'sent'}
                  type="button"
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#543ab7] px-4 py-2 text-sm font-semibold text-[#ffffff] hover:bg-[#4a319f] disabled:opacity-50"
                >
                  <MessageCircle className="h-4 w-4" />
                  {chatRequestState === 'sent'
                    ? 'Request sent'
                    : chatRequestState === 'sending'
                      ? 'Sending…'
                      : 'Request Chat'}
                </button>
                {chatRequestState === 'error' && <p className="text-xs text-wl-danger">{chatRequestError}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
