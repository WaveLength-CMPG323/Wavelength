import type { Conversation } from './types';

export interface PresetIcon { id: string; label: string; glyph: string; from: string; to: string }

/** The ONLY images a group can use. Users pick from this list; there is no upload path. */
export const PRESET_ICONS: PresetIcon[] = [
  { id: 'headphones', label: 'Headphones', glyph: '🎧', from: '#3d2fb0', to: '#2f6fd8' },
  { id: 'guitar', label: 'Guitar', glyph: '🎸', from: '#4a3cc9', to: '#17b6c4' },
  { id: 'keys', label: 'Keys', glyph: '🎹', from: '#2f6fd8', to: '#17b6c4' },
  { id: 'drums', label: 'Drums', glyph: '🥁', from: '#3d2fb0', to: '#4a3cc9' },
  { id: 'mic', label: 'Microphone', glyph: '🎤', from: '#4a3cc9', to: '#2f6fd8' },
  { id: 'sax', label: 'Saxophone', glyph: '🎷', from: '#2f6fd8', to: '#3d2fb0' },
  { id: 'wave', label: 'Wave', glyph: '🌊', from: '#17b6c4', to: '#2f6fd8' },
  { id: 'vinyl', label: 'Vinyl', glyph: '💿', from: '#0c1230', to: '#4a3cc9' },
];

const now = Date.now();
const min = 60_000, hr = 60 * min, day = 24 * hr;

export const SEED_CONVERSATIONS: Conversation[] = [
  {
    id: 'c1', name: 'Jake Doe', isGroup: false, avatar: { kind: 'person', color: '#3b82f6' },
    online: true, listening: 'Peace of Mind', updatedAt: now - 5 * min,
    messages: [
      { id: 'm1', from: 'them', text: 'This track is on repeat for me today.', sentAt: now - 40 * min },
      { id: 'm2', from: 'me', text: 'Adding it to my queue right now.', sentAt: now - 35 * min },
    ],
  },
  {
    id: 'c2', name: 'Theo Park', isGroup: false, avatar: { kind: 'person', color: '#22c55e' },
    online: false, updatedAt: now - 2 * hr, messages: [],
  },
  {
    id: 'g1', name: 'Friday Listening Club', isGroup: true, avatar: { kind: 'preset', presetId: 'headphones' },
    updatedAt: now - 3 * day,
    messages: [{ id: 'm1', from: 'them', author: 'Priya', text: 'Album of the week is up for a vote.', sentAt: now - 3 * day }],
  },
  {
    id: 'g2', name: 'City Pop Crate Diggers', isGroup: true, avatar: { kind: 'preset', presetId: 'vinyl' },
    updatedAt: now - 6 * hr,
    messages: [{ id: 'm1', from: 'them', author: 'Mei', text: 'Found a mint copy of Plastic Love today.', sentAt: now - 6 * hr }],
  },
];
