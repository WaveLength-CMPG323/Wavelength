export type AvatarSpec =
  | { kind: 'person'; color: string }      // friends: generic silhouette, solid color — no uploads
  | { kind: 'preset'; presetId: string };  // groups: must be one of PRESET_ICONS, no uploads

export interface Message {
  id: string;
  from: 'me' | 'them';
  author?: string; // shown above received messages in groups
  text: string;
  sentAt: number;
}

export interface Conversation {
  id: string;
  name: string;
  isGroup: boolean;
  avatar: AvatarSpec;
  messages: Message[];
  online?: boolean;
  listening?: string; // current track title — friends only, shown in place of "Tap to chat"
  typing?: boolean;
  updatedAt: number;
}
