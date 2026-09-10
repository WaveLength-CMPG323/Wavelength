import React from 'react';
import { Users } from 'lucide-react';
import { OceanWaveIcon } from './icons/OceanWaveIcon';
import type { Challenge } from '../types';

interface ChallengesProps {
  challenges: Challenge[];
}

export const WeeklyChallengesWireframe: React.FC<ChallengesProps> = ({ challenges }) => {
  return (
    <div className="space-y-4 text-white">
      <div className="flex items-center gap-2 border-b border-cyan-500/20 pb-3">
        <OceanWaveIcon className="w-5 h-5 text-cyan-400 shrink-0" />
        <h2 className="text-base font-bold tracking-wide text-cyan-200">
          Weekly Challenges
        </h2>
      </div>

      <div className="space-y-4">
        {challenges.map((challenge) => (
          <div 
            key={challenge.id} 
            className="p-4 bg-[#02233b]/80 backdrop-blur-md rounded-xl border border-cyan-500/20 shadow-md flex flex-col justify-between gap-3"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="bg-cyan-500/20 text-cyan-300 text-[10px] px-2 py-0.5 rounded border border-cyan-500/30 font-medium">
                  {challenge.theme}
                </span>
                <span className="text-[11px] text-slate-400 shrink-0">{challenge.deadline}</span>
              </div>
              <h3 className="text-sm font-bold text-cyan-100">{challenge.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{challenge.description}</p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-cyan-500/10 text-xs">
              <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                {challenge.participantsCount} Joined
              </span>
              <button className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs px-3 py-1 rounded-md transition">
                Join
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};