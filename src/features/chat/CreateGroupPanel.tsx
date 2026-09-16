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
    <NavPanel open={open} onClose={onClose} title="Create Group">
      <div className="flex flex-col gap-4 px-5 py-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-cyan-300">Group name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Late Night Lo-fi"
            className="w-full rounded-lg border border-cyan-500/20 bg-[#02182b] px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-cyan-300">Choose an icon</label>
          <div className="flex gap-2">
            {PREDEFINED_ICONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setIcon(opt)}
                type="button"
                className={`h-12 w-12 overflow-hidden rounded-full ring-2 ${icon === opt ? 'ring-cyan-400' : 'ring-transparent'}`}
              >
                <img src={opt} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-cyan-300">Add friends</label>
          {friendIds.length === 0 && <p className="text-xs text-slate-500">No friends yet to add.</p>}
          <div className="flex flex-col gap-1">
            {friendIds.map((id) => (
              <label key={id} className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={members.includes(id)} onChange={() => toggleMember(id)} />
                {db.users[id].name}
              </label>
            ))}
          </div>
        </div>

        <button onClick={submit} type="button" className="rounded-full bg-[#1ED760] py-2.5 text-sm font-semibold text-black hover:bg-[#1fdf64]">
          Create Group
        </button>
      </div>
    </NavPanel>
  );
}
