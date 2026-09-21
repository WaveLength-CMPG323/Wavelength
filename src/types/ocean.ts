// 1. Core track interface matching Spotify metadata structures

export interface Track {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  spotifyUri: string;
}

// 2. User Node interface representing a floating listener on the ocean canvas

export interface UserNode {
  userId: string;
  displayName: string;
  avatarUrl: string;
  currentTrack: Track | null;
  isPlaying: boolean;
  activeCosmeticEffect?: 'glow' | 'ripple' | 'frame';

  // Dynamic Canvas Coordinate & Depth Attributes
  
  x: number;           // Horizontal base position in canvas pixel space
  y: number;           // Vertical base position in canvas pixel space
  layer: number;       // Depth plane: 0 (background), 1 (midground), 2 (foreground)
  floatOffset: number; // Random phase offset for trigonometric floating calculation
}