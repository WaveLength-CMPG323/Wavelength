import { useState } from 'react';
import NavPanel from '../../components/NavPanel';
import { useData } from '../../data/DataContext';

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
  const { db, createGroup } = useData();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(PREDEFINED_ICONS[0]);
  const [members, setMembers] = useState<string[]>([]);

  const friendIds = Object.keys(db.users).filter((id) => db.users[id].chatStatus === 'friend');

  function toggleMember(id: string) {
    setMembers((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  function submit() {
    if (!name.trim()) return;
    const id = createGroup(name.trim(), icon, members);
    setName('');
    setMembers([]);
    onClose();
    onCreated(id);
  }

  return (
  <NavPanel open={open} onClose={onClose} title="Create Group" wide>
    <div className="flex flex-col gap-5 px-5 py-5">

      {/* Group name */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-cyan-100">
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
            bg-[#050e26]/70
            px-4 py-3
            text-sm text-white
            outline-none
            placeholder:text-cyan-200/30
            transition
            focus:border-cyan-400/50
            focus:bg-[#050e26]/90
          "
        />
      </div>

      {/* Preset group picture */}
      <div>
        <div className="mb-2">
          <p className="text-sm font-semibold text-cyan-100">
            Group picture
          </p>
          <p className="mt-0.5 text-xs text-cyan-200/50">
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
                      : 'border-white/10 opacity-70 hover:border-cyan-400/40 hover:opacity-100'
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
          <p className="text-sm font-semibold text-cyan-100">
            Add friends
          </p>
          <p className="mt-0.5 text-xs text-cyan-200/50">
            Select the people you want in this group.
          </p>
        </div>

        {friendIds.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/40">
            No friends yet to add.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {friendIds.map((id) => {
              const user = db.users[id];
              const selected = members.includes(id);

              return (
                <label
                  key={id}
                  className={`
                    flex cursor-pointer items-center gap-3
                    rounded-xl border px-3 py-2.5
                    transition
                    ${
                      selected
                        ? 'border-cyan-400/30 bg-cyan-400/10'
                        : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'
                    }
                  `}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleMember(id)}
                    className="accent-cyan-400"
                  />

                  <img
                    src={user.pic}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />

                  <span className="text-sm text-white/85">
                    {user.name}
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
        disabled={!name.trim()}
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
