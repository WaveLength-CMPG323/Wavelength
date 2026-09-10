import type { UserProfile, SocialPost, Challenge } from './types';

export const mockProfile: UserProfile = {
  id: 'usr-1',
  username: 'ocean_surfer',
  displayName: 'Lee-Anne',
  avatarUrl: 'https://via.placeholder.com/150',
  oceanTier: 'Abyssal',
  bio: 'Exploring deep sea electronic rhythms and lo-fi soundscapes.',
  favoriteGenre: 'Ambient Techno'
};

export const mockPosts: SocialPost[] = [
  {
    id: 'post-101',
    userId: 'usr-1',
    username: 'ocean_surfer',
    userAvatar: 'https://via.placeholder.com/40',
    trackTitle: 'Midnight Trench',
    artistName: 'Deep Wave',
    coverArtUrl: 'https://via.placeholder.com/300',
    caption: 'Late night vibes in the Hadopelagic zone.',
    likesCount: 24,
    timestamp: '2h ago'
  },
  {
    id: 'post-102',
    userId: 'usr-2',
    username: 'coral_reformer',
    userAvatar: 'https://via.placeholder.com/40',
    trackTitle: 'Bioluminescent Beats',
    artistName: 'SubAqua',
    coverArtUrl: 'https://via.placeholder.com/300',
    caption: 'Sharing this week’s ocean challenge submission!',
    likesCount: 57,
    timestamp: '5h ago'
  }
];

export const mockChallenges: Challenge[] = [
  {
    id: 'chal-1',
    title: 'Deep Echoes',
    description: 'Submit tracks recorded or produced with underwater sound samples.',
    theme: 'Ocean Sounds',
    participantsCount: 142,
    deadline: '3 days left',
    isActive: true
  },
  {
    id: 'chal-2',
    title: 'Abyssal Rhythm',
    description: 'Create a track strictly under 90 BPM with heavy bass resonance.',
    theme: 'Low Frequency',
    participantsCount: 89,
    deadline: 'Ends Sunday',
    isActive: true
  }
];