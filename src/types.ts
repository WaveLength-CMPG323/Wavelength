// Profile information for WaveLength users
export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  oceanTier: 'Shallow' | 'Midwater' | 'Abyssal' | 'Hadopelagic';
  bio: string;
  favoriteGenre: string;
}

// Social feed posts and interactions
export interface SocialPost {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  trackTitle: string;
  artistName: string;
  coverArtUrl: string;
  caption: string;
  likesCount: number;
  timestamp: string;
}

// Platform challenges and events
export interface Challenge {
  id: string;
  title: string;
  description: string;
  theme: string;
  participantsCount: number;
  deadline: string;
  isActive: boolean;
}