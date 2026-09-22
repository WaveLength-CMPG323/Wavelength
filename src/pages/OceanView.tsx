import React, { useState } from 'react';
import {
  Compass,
  Headphones,
  Home,
  Radio,
  Search,
  Trophy,
  Users,
  Waves,
} from 'lucide-react';

import { OceanCanvas } from '../components/OceanCanvas';
import { SongDetailsPanel } from '../components/SongDetailsPanel';
import { UserNode } from '../types/ocean';
import { OceanPlayer } from '../components/OceanPlayer';
import { mockOceanUsers } from '../data/oceanMockData';


export const OceanView: React.FC = () => {
  const [nodes] = useState<UserNode[]>(mockOceanUsers);
  const [selectedNode, setSelectedNode] = useState<UserNode | null>(null);

  const handleAction = (action: string) => {
    if (action === 'listen' && selectedNode?.currentTrack) {
      window.open(
        `https://open.spotify.com/track/${selectedNode.currentTrack.id}`,
        '_blank'
      );
    } else if (action === 'chat_request' && selectedNode) {
      console.log('Chat request for user:', selectedNode.userId);
      alert(`Chat request sent to ${selectedNode.displayName}!`);
    }
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#020b18] text-white">
      {/* Animated ocean background */}
      <div className="absolute inset-0">
        <OceanCanvas
          nodes={nodes}
          onSelectNode={setSelectedNode}
          selectedNodeId={selectedNode?.userId}
        />
      </div>

      {/* Top navigation */}
      <header className="absolute left-4 right-4 top-4 z-20 flex h-16 items-center justify-between rounded-2xl border border-cyan-300/15 bg-[#031525]/75 px-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-400/10">
            <Waves className="size-6 text-cyan-300" />
          </div>

          <div>
            <p className="text-lg font-bold tracking-wide text-cyan-50">
              WaveLength
            </p>
            <p className="text-xs text-cyan-200/50">Ocean Discovery</p>
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-cyan-300/10 bg-black/20 px-4 py-2 text-sm text-cyan-100/60 md:flex">
          <Search className="size-4" />
          Discover what people are listening to
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium">Madison</p>
            <p className="text-xs text-cyan-200/50">Exploring the ocean</p>
          </div>

          <div className="size-9 rounded-full border-2 border-cyan-300/40 bg-cyan-400/10" />
        </div>
      </header>

      {/* Left navigation panel */}
      <aside className="absolute bottom-5 left-4 top-24 z-10 hidden w-56 rounded-2xl border border-cyan-300/15 bg-[#031525]/70 p-4 shadow-2xl backdrop-blur-xl lg:block">
        <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/40">
          Explore
        </p>

        <nav className="space-y-2">
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
            <Home className="size-5" />
            Home
          </button>

          <button className="flex w-full items-center gap-3 rounded-xl border border-cyan-300/15 bg-cyan-400/10 px-3 py-3 text-sm font-medium text-cyan-200">
            <Waves className="size-5" />
            Ocean
          </button>

          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
            <Compass className="size-5" />
            Discover
          </button>

          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
            <Users className="size-5" />
            Groups
          </button>

          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
            <Trophy className="size-5" />
            Challenges
          </button>
        </nav>

        <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-cyan-300/10 bg-black/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Radio className="size-4 text-green-400" />
            <span className="text-xs font-semibold text-green-300">
              LIVE OCEAN
            </span>
          </div>
          <p className="text-xs leading-5 text-slate-400">
            {nodes.length} listeners are discovering music right now.
          </p>
        </div>
      </aside>

      {/* Ocean title */}
      <section className="pointer-events-none absolute left-1/2 top-28 z-10 -translate-x-1/2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300/60">
          Live Discovery
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          The Ocean
        </h1>
        <p className="mt-2 text-sm text-slate-300/70">
          Select a listener to discover what they're playing.
        </p>
      </section>

      {/* Right information panel */}
      <aside className="absolute bottom-5 right-4 top-24 z-10 hidden w-72 rounded-2xl border border-cyan-300/15 bg-[#031525]/70 p-5 shadow-2xl backdrop-blur-xl xl:block">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/50">
              Live
            </p>
            <h2 className="mt-1 text-lg font-semibold">Listening Now</h2>
          </div>

          <Headphones className="size-5 text-cyan-300" />
        </div>

        <div className="mt-6 space-y-3">
          {nodes.map((node) => (
            <button
              key={node.userId}
              onClick={() => setSelectedNode(node)}
              className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.04] p-3 text-left transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.06]"
            >
              <img
                src={node.avatarUrl}
                alt=""
                className="size-10 rounded-full object-cover"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">
                    {node.displayName}
                  </p>
                  <span
                    className={`size-2 rounded-full ${
                      node.isPlaying ? 'bg-green-400' : 'bg-amber-400'
                    }`}
                  />
                </div>

                <p className="truncate text-xs text-slate-400">
                  {node.currentTrack
                    ? `${node.currentTrack.title} · ${node.currentTrack.artist}`
                    : 'Not currently listening'}
                </p>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 border-t border-cyan-300/10 pt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/50">
            Weekly Challenge
          </p>

          <div className="mt-3 rounded-xl border border-cyan-300/10 bg-cyan-400/[0.05] p-4">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-cyan-300" />
              <p className="text-sm font-semibold">Explore New Waters</p>
            </div>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              Discover 5 new artists through other listeners.
            </p>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-2/5 rounded-full bg-cyan-400" />
            </div>

            <p className="mt-2 text-right text-xs text-cyan-200/60">2 / 5</p>
          </div>
        </div>
      </aside>

      {/* Mock music player */}
      <div className="absolute bottom-4 left-64 right-80 z-20 hidden h-20 rounded-2xl border border-cyan-300/15 bg-[#031525]/80 shadow-2xl backdrop-blur-xl xl:block">
          <OceanPlayer
            title={nodes[0]?.currentTrack?.title ?? 'Nothing playing'}
            artist={nodes[0]?.currentTrack?.artist ?? ''}
            albumArt={
              nodes[0]?.currentTrack?.albumArt ??
              'https://picsum.photos/100?random=7'
          }
      />
      </div>

      {/* Existing listener details drawer */}
      <SongDetailsPanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onActionClick={handleAction}
      />
    </main>
  );
};

export default OceanView;