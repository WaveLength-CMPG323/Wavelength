import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { PRESET_ICONS } from '../data';

interface Props { onCreate: (name: string, presetId: string) => void; onClose: () => void }

export function NewGroupModal({ onCreate, onClose }: Props) {
  const [name, setName] = useState('');
  const [presetId, setPresetId] = useState(PRESET_ICONS[0].id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) onCreate(name.trim(), presetId);
  };

  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form role="dialog" aria-modal="true" aria-label="New group" onSubmit={submit} onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="w-full max-w-sm rounded-3xl border border-white/35 bg-wl-indigo/85 p-6 text-white shadow-2xl backdrop-blur-xl">
        <h2 className="text-xl font-semibold">New group</h2>
        <label className="mt-5 block text-sm text-white/80" htmlFor="group-name">Group name</label>
        <input id="group-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={30}
          placeholder="e.g. Sunday Vinyl Club"
          className="mt-1.5 w-full rounded-full bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" />

        <p id="icon-label" className="mt-5 text-sm text-white/80">Group icon</p>
        <div role="radiogroup" aria-labelledby="icon-label" className="mt-2 grid grid-cols-4 gap-2.5">
          {PRESET_ICONS.map((p) => {
            const selected = p.id === presetId;
            return (
              <button key={p.id} type="button" role="radio" aria-checked={selected} aria-label={p.label} onClick={() => setPresetId(p.id)}
                className="relative grid aspect-square place-items-center rounded-xl text-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }}>
                {selected && (
                  <motion.span layoutId="preset-ring" className="absolute -inset-1 rounded-[14px] border-2 border-white"
                    transition={{ type: 'spring', stiffness: 500, damping: 34 }} />
                )}
                {p.glyph}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="rounded-full border border-white/40 px-5 py-2.5 text-sm hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white">
            Cancel
          </button>
          <button type="submit" disabled={!name.trim()}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            Create group
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
