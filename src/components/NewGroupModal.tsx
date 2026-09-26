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
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.form
        role="dialog"
        aria-modal="true"
        aria-label="New group"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="w-full max-w-sm rounded-2xl border border-white/15 bg-brand-cobalt p-6 text-white shadow-2xl"
      >
        <h2 className="text-xl font-semibold">New group</h2>
        <label className="mt-5 block text-sm text-white/60" htmlFor="group-name">Group name</label>
        <input
          id="group-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder="e.g. Sunday Vinyl Club"
          className="mt-1.5 w-full rounded-full bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sky"
        />

        <p id="icon-label" className="mt-5 text-sm text-white/60">Group icon</p>
        <div role="radiogroup" aria-labelledby="icon-label" className="mt-2 grid grid-cols-4 gap-2.5">
          {PRESET_ICONS.map((p) => {
            const selected = p.id === presetId;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={p.label}
                onClick={() => setPresetId(p.id)}
                className="relative grid aspect-square place-items-center rounded-xl text-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sky"
                style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }}
              >
                {selected && (
                  <motion.span
                    layoutId="preset-ring"
                    className="absolute -inset-1 rounded-[14px] border-2 border-brand-sky"
                    transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                  />
                )}
                {p.glyph}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-brand-sky"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-full bg-brand-azure px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sky"
          >
            Create group
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
