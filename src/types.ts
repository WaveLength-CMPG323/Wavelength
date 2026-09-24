export type AvatarSpec =
  | { kind: 'initials'; hue: number }      // direct chats: generated, no uploads
  | { kind: 'preset'; presetId: string };  // groups: must be one of PRESET_ICONS

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
  unread: number;
  updatedAt: number;
  online?: boolean;
  typing?: boolean;
}
