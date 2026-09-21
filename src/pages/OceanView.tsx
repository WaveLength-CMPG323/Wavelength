import React, { useState } from 'react';
import { OceanCanvas } from '../components/OceanCanvas';
import { SongDetailsPanel } from '../components/SongDetailsPanel';
import { UserNode } from '../types/ocean';

// Mock active listeners floating on the ocean UI
const INITIAL_NODES: UserNode[] = [
  {
    userId: '1',
    displayName: 'Alex',
    avatarUrl: 'https://i.pravatar.cc/100?img=1',
    isPlaying: true,
    x: 250,
    y: 320,
    layer: 1,
    floatOffset: 0,
    activeCosmeticEffect: 'glow',
    currentTrack: {
      id: '11dFghVXANM3er93A9SuP0',
      title: 'Midnight City',
      artist: 'M83',
      albumArt: 'https://picsum.photos/200?random=1',
      spotifyUri: 'spotify:track:11dFghVXANM3er93A9SuP0',
    },
  },
  {
    userId: '2',
    displayName: 'Sarah',
    avatarUrl: 'https://i.pravatar.cc/100?img=2',
    isPlaying: false,
    x: 550,
    y: 220,
    layer: 0,
    floatOffset: 2.5,
    currentTrack: {
      id: '0VjAaw22BSuM9R3A9SuP0',
      title: 'Starboy',
      artist: 'The Weeknd',
      albumArt: 'https://picsum.photos/200?random=2',
      spotifyUri: 'spotify:track:0VjAaw22BSuM9R3A9SuP0',
    },
  },
];

export const OceanView: React.FC = () => {
  const [nodes] = useState<UserNode[]>(INITIAL_NODES);
  const [selectedNode, setSelectedNode] = useState<UserNode | null>(null);

  // Interaction Handler for Slide-In Panel
  const handleAction = (action: string) => {
    if (action === 'listen' && selectedNode?.currentTrack) {
      window.open(
        `https://open.spotify.com/track/${selectedNode.currentTrack.id}`,
        '_blank'
      );
    } else if (action === 'chat_request' && selectedNode) {
      alert(`Chat request sent to ${selectedNode.displayName}!`);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* Interactive HTML5 Canvas Engine */}
      <OceanCanvas
        nodes={nodes}
        onSelectNode={(node) => setSelectedNode(node)}
        selectedNodeId={selectedNode?.userId}
      />

      {/* Framer Motion Slide-In Detail Drawer */}
      <SongDetailsPanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onActionClick={handleAction}
      />
    </div>
  );
};

export default OceanView;