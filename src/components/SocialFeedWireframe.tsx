import React from 'react';
import { Heart, MessageSquare, Repeat, Play } from 'lucide-react';
import type { SocialPost } from '../types';

interface SocialFeedProps {
  posts: SocialPost[];
}

export const SocialFeedWireframe: React.FC<SocialFeedProps> = ({ posts }) => {
  return (
    <div className="max-w-2xl mx-auto my-8 space-y-6 text-white">
      <h2 className="text-xl font-bold tracking-wide text-cyan-200 border-b border-cyan-500/20 pb-2">
        Ocean Waves (Social Feed)
      </h2>

      {posts.map((post) => (
        <div 
          key={post.id} 
          className="p-5 bg-[#04385a]/90 backdrop-blur-md rounded-2xl border border-cyan-500/20 shadow-xl space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-300 text-slate-800 flex items-center justify-center font-semibold text-xs border border-cyan-400">
                avatar
              </div>
              <div>
                <p className="font-semibold text-sm text-cyan-100">@{post.username}</p>
                <p className="text-xs text-slate-400">{post.timestamp}</p>
              </div>
            </div>
          </div>

          <p className="text-sm text-slate-200">{post.caption}</p>

          <div className="p-4 bg-cyan-950/60 rounded-xl border border-cyan-500/30 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-cyan-200">{post.trackTitle}</p>
              <p className="text-xs text-slate-400">{post.artistName}</p>
            </div>
            <button className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs px-3 py-1.5 rounded-full transition flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5 fill-current" />
              Play Track
            </button>
          </div>

          <div className="flex items-center gap-6 pt-2 text-xs text-cyan-300 border-t border-cyan-500/10">
            <button className="flex items-center gap-1.5 hover:text-cyan-100 transition">
              <Heart className="w-4 h-4 text-cyan-400" />
              <span>{post.likesCount} Likes</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-cyan-100 transition">
              <MessageSquare className="w-4 h-4 text-cyan-400" />
              <span>Comment</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-cyan-100 transition">
              <Repeat className="w-4 h-4 text-cyan-400" />
              <span>Share Wave</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};