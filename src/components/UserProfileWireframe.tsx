import React from 'react';
import type { UserProfile } from '../types';

interface UserProfileProps {
  profile: UserProfile;
}

export const UserProfileWireframe: React.FC<UserProfileProps> = ({ profile }) => {
  return (
    <div className="max-w-4xl mx-auto my-8 p-8 bg-[#04385a]/90 backdrop-blur-md rounded-3xl border border-cyan-500/20 shadow-2xl text-white">
      {/* SECTION 1: Header (Avatar, Details, Action Buttons) */}
      <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 pb-6 border-b border-cyan-500/20">
        
        {/* Left: Avatar Placeholder */}
        <div className="flex items-center gap-6">
          <div className="w-28 h-28 rounded-full bg-slate-300 text-slate-800 flex items-center justify-center font-semibold text-lg border-2 border-cyan-400 shadow-md shrink-0">
            avatar
          </div>

          {/* Center: User Details & Genre Pills */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-wide text-cyan-100">
              {profile.displayName} <span className="text-sm font-normal text-cyan-400">(@{profile.username})</span>
            </h2>
            <p className="text-sm text-slate-300 max-w-sm">
              {profile.bio}
            </p>
            <div className="inline-block bg-cyan-950/80 text-cyan-300 text-xs px-2.5 py-0.5 rounded border border-cyan-500/30">
              Tier: {profile.oceanTier}
            </div>

            {/* Genre Pills */}
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="bg-slate-200 text-slate-900 text-xs font-medium px-3 py-1 rounded-full shadow-sm">
                {profile.favoriteGenre}
              </span>
              <span className="bg-slate-200 text-slate-900 text-xs font-medium px-3 py-1 rounded-full shadow-sm">
                Electronic
              </span>
              <span className="bg-slate-200 text-slate-900 text-xs font-medium px-3 py-1 rounded-full shadow-sm">
                Lo-Fi
              </span>
            </div>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex flex-col gap-3 w-full md:w-auto shrink-0">
          <button className="w-full md:w-44 bg-black hover:bg-slate-900 text-white font-medium py-2 px-4 rounded-md border border-slate-700 transition">
            Follow
          </button>
          <button className="w-full md:w-44 bg-slate-200 hover:bg-white text-slate-900 font-medium py-2 px-4 rounded-md transition shadow">
            Send Chat Request
          </button>
        </div>

      </div>

      {/* Placeholder for SECTION 2 (Stats) & SECTION 3 (Shared Tracks) */}
      <div className="pt-6 text-center text-cyan-400/60 text-sm">
        [ Stats & Shared Tracks Grid to be added in Next Step ]
      </div>
    </div>
  );
};