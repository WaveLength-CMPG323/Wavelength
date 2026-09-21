import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserNode } from '../types/ocean';

interface SongDetailsPanelProps {
  node: UserNode | null;
  onClose: () => void;
  onActionClick: (action: string) => void;
}

export const SongDetailsPanel: React.FC<SongDetailsPanelProps> = ({
  node,
  onClose,
  onActionClick,
}) => {
  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-0 right-0 h-full w-80 md:w-96 bg-slate-900/95 backdrop-blur-md text-white z-50 p-6 shadow-2xl border-l border-slate-700 flex flex-col justify-between"
        >
          <div>
            {/* Header / Dismiss */}
            <div className="flex justify-between items-center mb-6">
              <span className="text-xs uppercase tracking-widest text-cyan-400 font-semibold">
                Live Discovery
              </span>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            {/* Listener Context */}
            <div className="flex items-center gap-3 mb-6">
              <img
                src={node.avatarUrl}
                alt={node.displayName}
                className="w-10 h-10 rounded-full border border-cyan-500 object-cover"
              />
              <div>
                <p className="font-medium text-sm">{node.displayName}</p>
                <p className="text-xs text-slate-400">
                  {node.isPlaying ? '🟢 Listening Now' : '🟡 Paused'}
                </p>
              </div>
            </div>

            {/* Track Info Card */}
            {node.currentTrack ? (
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700 mb-6">
                <img
                  src={node.currentTrack.albumArt}
                  alt={node.currentTrack.title}
                  className="w-full aspect-square object-cover rounded-lg mb-4 shadow-md"
                />
                <h3 className="text-lg font-bold truncate">{node.currentTrack.title}</h3>
                <p className="text-sm text-slate-300 truncate">{node.currentTrack.artist}</p>
              </div>
            ) : (
              <p className="text-slate-400 italic mb-6">No track actively playing.</p>
            )}

            {/* Interactive Actions */}
            <div className="space-y-3">
              <button
                onClick={() => onActionClick('listen')}
                className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold py-2.5 px-4 rounded-full flex items-center justify-center gap-2 transition-transform active:scale-95"
              >
                Listen on Spotify
              </button>
              <button
                onClick={() => onActionClick('chat_request')}
                className="w-full bg-slate-700 hover:bg-slate-600 font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Send Chat Request
              </button>
            </div>
          </div>

          {/* Spotify Attribution Line */}
          <div className="text-center pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-500">Powered by Spotify Web API</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};