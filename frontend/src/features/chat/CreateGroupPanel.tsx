import { useState } from 'react';
import NavPanel from '../../components/NavPanel';
import { createServerGroup } from '../../lib/api';
import type { GroupVisibility, ServerGroup } from '../../data/types';

const PREDEFINED_ICONS = ['/avatars/avatar1.svg', '/avatars/avatar2.svg', '/avatars/avatar3.svg', '/avatars/avatar4.svg', '/avatars/avatar5.svg', '/avatars/avatar6.svg'];

export default function CreateGroupPanel({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (group: ServerGroup) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(PREDEFINED_ICONS[0]);
  const [visibility, setVisibility] = useState<GroupVisibility>('public');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    const trimmedName = name.trim();
    if (!trimmedName || saving) return;

    setError('');
    setSaving(true);
    try {
      // The backend identifies the owner from the login session; mock friend IDs are not sent as members.
      const group = await createServerGroup({
        name: trimmedName,
        description: description.trim() || undefined,
        icon,
        visibility,
      });
      setName('');
      setDescription('');
      setIcon(PREDEFINED_ICONS[0]);
      setVisibility('public');
      onClose();
      onCreated(group);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create group');
    } finally {
      setSaving(false);
    }
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
          <label className="mb-1 block text-sm font-semibold text-cyan-300">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-cyan-500/20 bg-[#02182b] px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
        </div>

        <fieldset>
          <legend className="mb-1 block text-sm font-semibold text-cyan-300">Visibility</legend>
          <div className="flex gap-2">
            {(['public', 'private'] as const).map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="radio"
                  name="group-visibility"
                  value={option}
                  checked={visibility === option}
                  onChange={() => setVisibility(option)}
                />
                {option === 'public' ? 'Public' : 'Private'}
              </label>
            ))}
          </div>
        </fieldset>

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

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        <button onClick={() => void submit()} disabled={saving || !name.trim()} type="button" className="rounded-full bg-[#1ED760] py-2.5 text-sm font-semibold text-black hover:bg-[#1fdf64] disabled:opacity-50">
          {saving ? 'Creating…' : 'Create Group'}
        </button>
      </div>
    </NavPanel>
  );
}
