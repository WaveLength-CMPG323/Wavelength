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
    id: 'c1', name: 'Amara Osei', isGroup: false, avatar: { kind: 'initials', hue: 265 },
    online: true, typing: true, unread: 0, updatedAt: now - 2 * min,
    messages: [
      { id: 'm1', from: 'them', text: 'Have you heard the new Khruangbin record yet?', sentAt: now - 9 * min },
      { id: 'm2', from: 'me', text: 'Not yet, is it worth a full listen?', sentAt: now - 6 * min },
      { id: 'm3', from: 'them', text: 'Start with track three. You’ll thank me.', sentAt: now - 2 * min },
    ],
  },
  {
    id: 'c2', name: 'Diego Marchetti', isGroup: false, avatar: { kind: 'initials', hue: 200 },
    unread: 3, updatedAt: now - 70 * min,
    messages: [{ id: 'm1', from: 'them', text: 'That playlist you sent is on repeat.', sentAt: now - 70 * min }],
  },
  {
    id: 'c3', name: 'Yuki Tanaka', isGroup: false, avatar: { kind: 'initials', hue: 330 },
    unread: 0, updatedAt: now - day,
    messages: [{ id: 'm1', from: 'me', text: 'Let’s trade our favourite city-pop finds.', sentAt: now - day }],
  },
  {
    id: 'g1', name: 'Friday Listening Club', isGroup: true, avatar: { kind: 'preset', presetId: 'headphones' },
    unread: 12, updatedAt: now - 3 * day,
    messages: [
      { id: 'm1', from: 'them', author: 'Priya', text: 'Album of the week is up for a vote.', sentAt: now - 3 * day },
    ],
  },
];

export function formatStamp(ts: number): string {
  const d = new Date(ts);
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  if (ts >= startOfToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  if (ts >= startOfToday - day) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short' });
}
