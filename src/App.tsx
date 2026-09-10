import { useState } from 'react';
import { UserProfileWireframe } from './components/UserProfileWireframe';
import { SocialFeedWireframe } from './components/SocialFeedWireframe';
import { WeeklyChallengesWireframe } from './components/WeeklyChallengesWireframe';
import { mockProfile, mockPosts, mockChallenges } from './mockData';
import { User, Radio, Trophy, Compass, Music, Flame } from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState<'feed' | 'profile'>('feed');

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Top Header */}
      <header className="h-16 border-b border-cyan-500/20 bg-[#02182b]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center font-bold text-slate-950">
            W
          </div>
          <span className="font-bold text-lg tracking-wider text-cyan-200">WaveLength</span>
        </div>
        <div className="text-xs text-cyan-400 bg-cyan-950/80 px-3 py-1 rounded-full border border-cyan-500/30">
          Abyssal Depth Layer
        </div>
      </header>

      {/* Main 3-Column Content Hub */}
      <div className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 md:p-6">
        
        {/* LEFT COLUMN: Persistent Navigation (3 cols) */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="bg-[#04385a]/60 backdrop-blur-md p-4 rounded-2xl border border-cyan-500/20 space-y-2">
            <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider px-3 mb-2">Menu</p>
            <button
              onClick={() => setActiveView('feed')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                activeView === 'feed'
                  ? 'bg-cyan-500 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20'
                  : 'text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200'
              }`}
            >
              <Radio className="w-4 h-4" />
              Ocean Waves Feed
            </button>
            <button
              onClick={() => setActiveView('profile')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                activeView === 'profile'
                  ? 'bg-cyan-500 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20'
                  : 'text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200'
              }`}
            >
              <User className="w-4 h-4" />
              My Profile
            </button>
          </div>

          <div className="bg-[#04385a]/60 backdrop-blur-md p-4 rounded-2xl border border-cyan-500/20 space-y-3">
            <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider px-1">Discover</p>
            <div className="flex items-center gap-2 text-xs text-slate-300 hover:text-cyan-200 cursor-pointer p-1">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>Explore Soundscapes</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300 hover:text-cyan-200 cursor-pointer p-1">
              <Flame className="w-4 h-4 text-cyan-400" />
              <span>Trending Audio Samples</span>
            </div>
          </div>
        </aside>

        {/* CENTER COLUMN: Main Content Area (6 cols) */}
        <main className="lg:col-span-6 space-y-6">
          {activeView === 'feed' && <SocialFeedWireframe posts={mockPosts} />}
          {activeView === 'profile' && <UserProfileWireframe profile={mockProfile} />}
        </main>

        {/* RIGHT COLUMN: Secondary Panel / Challenges (3 cols) */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="bg-[#04385a]/60 backdrop-blur-md p-4 rounded-2xl border border-cyan-500/20">
            <WeeklyChallengesWireframe challenges={mockChallenges} />
          </div>
        </aside>

      </div>
    </div>
  );
}
