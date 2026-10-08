import { useState } from 'react';
import NavPanel from '../../components/NavPanel';
import BorderFrame from '../../components/BorderFrame';
import { useChat } from '../../data/ChatContext';

const PREDEFINED_ICONS = ['/avatars/avatar1.svg', '/avatars/avatar2.svg', '/avatars/avatar3.svg', '/avatars/avatar4.svg', '/avatars/avatar5.svg', '/avatars/avatar6.svg'];

export default function CreateGroupPanel({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (groupId: string) => void;
}) {
  const { friends, createGroup } = useChat();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(PREDEFINED_ICONS[0]);
  const [members, setMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  function toggleMember(id: string) {
    setMembers((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  async function submit() {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const id = await createGroup(name.trim(), icon, members);
      setName('');
      setMembers([]);
      onClose();
      onCreated(id);
    } catch (err) {
      console.error('Could not create group:', err);
    } finally {
      setCreating(false);
    }
  }

  return (
  <NavPanel open={open} onClose={onClose} title="Create Group" wide>
    <div className="flex flex-col gap-5 px-5 py-5">

      {/* Group name */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-wl-title">
          Group name
        </label>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Late Night Lo-fi"
          maxLength={50}
          className="
            w-full rounded-xl
            border border-cyan-400/20
            bg-wl-bg/70
            px-4 py-3
            text-sm text-wl-fg
            outline-none
            placeholder:text-wl-faint
            transition
            focus:border-cyan-400/50
            focus:bg-wl-bg/90
          "
        />
      </div>

      {/* Preset group picture */}
      <div>
        <div className="mb-2">
          <p className="text-sm font-semibold text-wl-title">
            Group picture
          </p>
          <p className="mt-0.5 text-xs text-wl-muted">
            Choose one of the WaveLength presets.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {PREDEFINED_ICONS.map((opt) => {
            const selected = icon === opt;

            return (
              <button
                key={opt}
                onClick={() => setIcon(opt)}
                type="button"
                aria-label="Choose group picture"
                className={`
                  h-12 w-12 overflow-hidden rounded-full
                  border transition
                  ${
                    selected
                      ? 'border-cyan-300 ring-2 ring-cyan-400/40 shadow-[0_0_16px_rgba(34,211,238,0.25)]'
                      : 'border-wl-fg/10 opacity-70 hover:border-cyan-400/40 hover:opacity-100'
                  }
                `}
              >
                <img
                  src={opt}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Members */}
      <div>
        <div className="mb-2">
          <p className="text-sm font-semibold text-wl-title">
            Add friends
          </p>
          <p className="mt-0.5 text-xs text-wl-muted">
            Select the people you want in this group.
          </p>
        </div>

        {friends.length === 0 ? (
          <p className="rounded-xl border border-wl-fg/10 bg-wl-fg/[0.03] px-4 py-3 text-xs text-wl-fg/40">
            No friends yet to add.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {friends.map((friend) => {
              const selected = members.includes(friend.spotifyUserId);

              return (
                <label
                  key={friend.spotifyUserId}
                  className={`
                    flex cursor-pointer items-center gap-3
                    rounded-xl border px-3 py-2.5
                    transition
                    ${
                      selected
                        ? 'border-cyan-400/30 bg-cyan-400/10'
                        : 'border-wl-fg/5 bg-wl-fg/[0.02] hover:bg-wl-fg/[0.05]'
                    }
                  `}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleMember(friend.spotifyUserId)}
                    className="accent-cyan-400"
                  />

                  <BorderFrame border={friend.border} shape="circle" className="h-8 w-8" reserve="m-4">
                    <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-slate-700">
                      {friend.profileImage ? (
                        <img
                          src={friend.profileImage}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-wl-fg">
                          {friend.displayName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </BorderFrame>

                  <span className="text-sm text-wl-fg/85">
                    {friend.displayName}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Create */}
      <button
        onClick={submit}
        type="button"
        disabled={!name.trim() || creating}
        className="
          rounded-full
          bg-gradient-to-r from-blue-500 to-cyan-400
          py-3
          text-sm font-semibold text-white
          shadow-[0_6px_20px_rgba(34,211,238,0.18)]
          transition
          hover:brightness-110
          disabled:cursor-not-allowed
          disabled:opacity-40
        "
      >
        Create Group
      </button>
    </div>
  </NavPanel>
);
}
