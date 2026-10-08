import { useEffect, useState } from 'react';
import { LogOut, ShieldCheck, UserMinus, UserPlus } from 'lucide-react';
import NavPanel from '../../components/NavPanel';
import BorderFrame from '../../components/BorderFrame';
import { useChat } from '../../data/ChatContext';
import { useAuth } from '../../data/AuthContext';
import type { RealGroupMember } from '../../data/types';

interface Props {
  // The group to show, or null to keep the panel closed.
  groupId: string | null;
  onClose: () => void;
  // Opens a member's profile overlay (ChatProfileOverlay).
  onPersonClick: (spotifyUserId: string) => void;
  // Called after I leave, so ChatPage can close the now-gone conversation.
  onLeft: () => void;
}

const ROLE_LABEL: Record<RealGroupMember['role'], string | null> = {
  owner: 'Admin',
  moderator: 'Mod',
  member: null, // regular members get no badge
};

function Avatar({
  src,
  name,
  size = 'h-10 w-10',
  border,
  reserve,
}: {
  src: string | null;
  name: string;
  size?: string;
  border?: string | null;
  reserve?: string;
}) {
  return (
    <BorderFrame border={border} shape="circle" className={size} reserve={reserve}>
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-slate-700">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-semibold text-slate-100">{(name || '?').charAt(0).toUpperCase()}</span>
        )}
      </div>
    </BorderFrame>
  );
}

// Everything about a group in one place: who it is, who's in it and what
// role they have, plus the management actions each role is allowed:
//   Admin      - add people, promote/demote moderators, remove anyone
//   Moderator  - remove regular members only
//   Everyone   - leave the group
export default function GroupProfilePanel({ groupId, onClose, onPersonClick, onLeft }: Props) {
  const { groups, friends, leaveGroup, addGroupMembers, kickGroupMember, setGroupModerator } = useChat();
  const { profile } = useAuth();
  const group = groupId ? groups.find((g) => g.id === groupId) ?? null : null;

  const [busyId, setBusyId] = useState<string | null>(null); // member (or 'add'/'leave') being worked on
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  // Start fresh each time a (different) group is opened.
  useEffect(() => {
    setError('');
    setAdding(false);
    setPicked([]);
    setBusyId(null);
  }, [groupId]);

  // If the group disappears while the panel is open (I was removed, or it
  // was deleted), close it.
  useEffect(() => {
    if (groupId && !group) onClose();
  }, [groupId, group, onClose]);

  const myId = profile?.spotifyUserId ?? null;
  const me = group?.members.find((m) => m.spotifyUserId === myId) ?? null;
  const iAmAdmin = me?.role === 'owner';
  const iAmMod = me?.role === 'moderator';

  async function run(id: string, action: () => Promise<void>) {
    setBusyId(id);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  }

  function canKick(target: RealGroupMember): boolean {
    if (target.spotifyUserId === myId || target.role === 'owner') return false;
    if (iAmAdmin) return true;
    return iAmMod && target.role === 'member'; // moderators: regular members only
  }

  const roleOrder = { owner: 0, moderator: 1, member: 2 } as const;
  const members = group ? [...group.members].sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.joinedAt - b.joinedAt) : [];
  const addable = group ? friends.filter((f) => !group.members.some((m) => m.spotifyUserId === f.spotifyUserId)) : [];

  function handleLeave() {
    if (!group) return;
    const successor = iAmAdmin
      ? [...group.members].filter((m) => m.spotifyUserId !== myId).sort(
          (a, b) => (a.role === 'moderator' ? 0 : 1) - (b.role === 'moderator' ? 0 : 1) || a.joinedAt - b.joinedAt
        )[0]
      : null;
    const text = iAmAdmin
      ? successor
        ? `Leave "${group.name}"? ${successor.displayName} will become the new admin.`
        : `Leave "${group.name}"? You're the only member, so the group will be deleted.`
      : `Leave "${group.name}"? You'll no longer see this group or its messages.`;
    if (!confirm(text)) return;
    void run('leave', async () => {
      await leaveGroup(group.id);
      onClose();
      onLeft();
    });
  }

  return (
    <NavPanel open={Boolean(groupId && group)} onClose={onClose} title="Group info" wide>
      {group && (
        <div className="flex flex-col gap-5 px-5 py-5">
          {/* Group details */}
          <div className="flex flex-col items-center gap-2 text-center">
            {group.icon ? (
              <img src={group.icon} alt="" className="h-20 w-20 rounded-2xl object-cover" />
            ) : (
              <Avatar src={null} name={group.name} size="h-20 w-20" />
            )}
            <h2 className="text-lg font-bold text-wl-title">{group.name}</h2>
            {group.description ? (
              <p className="max-w-xs whitespace-pre-line text-sm text-wl-soft">{group.description}</p>
            ) : (
              <p className="text-sm text-wl-faint">No description</p>
            )}
            <p className="text-xs text-wl-muted">
              {group.visibility === 'private' ? 'Private group' : 'Public group'} · {group.members.length}{' '}
              {group.members.length === 1 ? 'member' : 'members'}
              {group.createdAt ? ` · Created ${new Date(group.createdAt).toLocaleDateString()}` : ''}
            </p>
          </div>

          {/* Members */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-wl-muted">Members</p>
              {iAmAdmin && (
                <button
                  type="button"
                  onClick={() => setAdding((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 px-3 py-1 text-xs font-medium text-wl-link transition hover:bg-cyan-500/10"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {adding ? 'Cancel' : 'Add people'}
                </button>
              )}
            </div>

            {adding && iAmAdmin && (
              <div className="mb-3 rounded-xl border border-cyan-400/20 bg-wl-bg/60 p-3">
                {addable.length === 0 ? (
                  <p className="text-xs text-wl-muted">All your friends are already in this group.</p>
                ) : (
                  <>
                    <div className="flex max-h-44 flex-col gap-1.5 overflow-y-auto">
                      {addable.map((friend) => {
                        const checked = picked.includes(friend.spotifyUserId);
                        return (
                          <label
                            key={friend.spotifyUserId}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-2.5 py-2 transition ${
                              checked ? 'border-cyan-400/40 bg-cyan-400/10' : 'border-transparent hover:bg-wl-fg/5'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setPicked((prev) =>
                                  prev.includes(friend.spotifyUserId)
                                    ? prev.filter((id) => id !== friend.spotifyUserId)
                                    : [...prev, friend.spotifyUserId]
                                )
                              }
                              className="accent-cyan-400"
                            />
                            <Avatar src={friend.profileImage} name={friend.displayName} size="h-8 w-8" border={friend.border} reserve="m-4" />
                            <span className="truncate text-sm text-wl-fg">{friend.displayName}</span>
                          </label>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      disabled={picked.length === 0 || busyId === 'add'}
                      onClick={() =>
                        void run('add', async () => {
                          await addGroupMembers(group.id, picked);
                          setPicked([]);
                          setAdding(false);
                        })
                      }
                      className="mt-3 w-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busyId === 'add' ? 'Adding…' : `Add ${picked.length || ''} ${picked.length === 1 ? 'person' : 'people'}`.replace('  ', ' ')}
                    </button>
                  </>
                )}
              </div>
            )}

            <ul className="flex flex-col gap-1">
              {members.map((member) => {
                const label = ROLE_LABEL[member.role];
                const isMe = member.spotifyUserId === myId;
                const working = busyId === member.spotifyUserId;
                return (
                  <li
                    key={member.spotifyUserId}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-wl-fg/[0.04]"
                  >
                    <button
                      type="button"
                      onClick={() => !isMe && onPersonClick(member.spotifyUserId)}
                      disabled={isMe}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                    >
                      <Avatar src={member.profileImage} name={member.displayName} border={member.border} reserve="m-4" />
                      <span className="min-w-0 truncate text-sm font-medium text-wl-fg">
                        {member.displayName}
                        {isMe && <span className="ml-1 font-normal text-wl-muted">(you)</span>}
                      </span>
                    </button>

                    {label && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          member.role === 'owner'
                            ? 'bg-amber-400/20 text-amber-400 light:text-amber-700'
                            : 'bg-cyan-400/20 text-wl-link'
                        }`}
                      >
                        {label}
                      </span>
                    )}

                    {iAmAdmin && member.role !== 'owner' && (
                      <button
                        type="button"
                        disabled={working}
                        onClick={() =>
                          void run(member.spotifyUserId, () =>
                            setGroupModerator(group.id, member.spotifyUserId, member.role !== 'moderator')
                          )
                        }
                        title={member.role === 'moderator' ? 'Remove moderator role' : 'Make moderator'}
                        aria-label={member.role === 'moderator' ? 'Remove moderator role' : 'Make moderator'}
                        className="shrink-0 rounded-full p-1.5 text-wl-icon transition hover:bg-cyan-500/10 hover:text-wl-cyan disabled:opacity-40"
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </button>
                    )}

                    {canKick(member) && (
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => {
                          if (confirm(`Remove ${member.displayName} from "${group.name}"?`)) {
                            void run(member.spotifyUserId, () => kickGroupMember(group.id, member.spotifyUserId));
                          }
                        }}
                        title="Remove from group"
                        aria-label={`Remove ${member.displayName} from group`}
                        className="shrink-0 rounded-full p-1.5 text-wl-danger/80 transition hover:bg-wl-danger/10 hover:text-wl-danger disabled:opacity-40"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {error && <p className="text-center text-xs text-wl-danger">{error}</p>}

          <button
            type="button"
            onClick={handleLeave}
            disabled={busyId === 'leave'}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-wl-danger/40 py-2.5 text-sm font-semibold text-wl-danger transition hover:bg-wl-danger/10 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            {busyId === 'leave' ? 'Leaving…' : 'Leave group'}
          </button>
        </div>
      )}
    </NavPanel>
  );
}
