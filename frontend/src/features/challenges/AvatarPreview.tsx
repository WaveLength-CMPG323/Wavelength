import CosmeticAvatar from '../../components/CosmeticAvatar';
import { useAuth } from '../../data/AuthContext';
import type { Cosmetic } from '../../data/types';

// "Here's what this cosmetic looks like on YOU" - the logged-in user's real
// Spotify avatar wearing the given cosmetic. Used to preview rewards in the
// challenge panel and the rewards gallery.
export default function AvatarPreview({ cosmetic, size }: { cosmetic: Cosmetic | null; size: number }) {
  const { profile } = useAuth();
  return (
    <CosmeticAvatar cosmetic={cosmetic} size={size}>
      <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-slate-700">
        {profile?.profileImage ? (
          <img src={profile.profileImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="font-semibold text-slate-300" style={{ fontSize: size * 0.4 }}>
            {(profile?.displayName || '?').charAt(0).toUpperCase()}
          </span>
        )}
      </span>
    </CosmeticAvatar>
  );
}
