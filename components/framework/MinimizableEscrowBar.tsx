import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Shield, Coins } from 'lucide-react';

interface MinimizableEscrowBarProps {
  points: number;
  dailyPointsEarned: number;
  isP2PConnected: boolean;
  activeP2PPointBet: number;
  onPlaceP2PPointBet: (stake: number) => void;
  arenaLabel?: string;
}

export const MinimizableEscrowBar: React.FC<MinimizableEscrowBarProps> = ({
  points,
  dailyPointsEarned,
  isP2PConnected,
  activeP2PPointBet,
  onPlaceP2PPointBet,
  arenaLabel = 'P2P Point Wager Escrow',
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  if (isMinimized) {
    return (
      <div className="flex items-center justify-between gap-4 px-4 py-2 bg-[#0B0A07] border border-yellow-500/30 rounded-xl text-xs">
        <div className="flex flex-wrap items-center gap-3 text-yellow-100 font-mono">
          <span className="flex items-center gap-1.5 font-bold text-yellow-400">
            <Shield className="w-3.5 h-3.5" />
            <span>{arenaLabel}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Active Bet: <strong className="text-yellow-400">{activeP2PPointBet} Pts</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Balance: <strong className="text-yellow-200">{points} Pts</strong> ({dailyPointsEarned}/50 Today)
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-neutral-300">
            {isP2PConnected ? 'P2P Mesh Connected' : 'Local Mode (Connect P2P to Wager)'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#16150E] hover:bg-yellow-400 hover:text-black text-yellow-300 border border-yellow-500/35 font-mono font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>Expand Escrow</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-[#0C0B08] border border-yellow-500/35 rounded-xl text-xs sm:text-sm shadow-md">
      <div className="flex flex-wrap items-center gap-2.5 text-yellow-100">
        <div className="flex items-center gap-1.5 font-bold text-yellow-400">
          <Coins className="w-4 h-4" />
          <span>{arenaLabel}:</span>
        </div>
        <span className="text-neutral-200">
          Earn <strong className="text-yellow-300">+1 Pt per win per day</strong> (max 50/day). Wager points on P2P mesh servers.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs sm:text-sm text-yellow-100 mr-1">
          {isP2PConnected ? 'P2P Server Active' : 'Offline Mode (Betting Locked)'} · Stake:{' '}
          <strong className="text-yellow-400">{activeP2PPointBet} Pts</strong>
        </span>

        {[0, 1, 3, 5, 10].map((stake) => (
          <button
            key={stake}
            type="button"
            disabled={!isP2PConnected || stake > points}
            onClick={() => onPlaceP2PPointBet(stake)}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg border transition-colors cursor-pointer disabled:opacity-40 ${
              activeP2PPointBet === stake
                ? 'bg-yellow-400 text-black border-yellow-200 shadow-sm'
                : 'bg-[#16150E] text-yellow-100 border-yellow-500/30 hover:border-yellow-400'
            }`}
          >
            {stake === 0 ? 'No Bet' : `Bet ${stake} Pt${stake > 1 ? 's' : ''}`}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setIsMinimized(true)}
          title="Minimize Betting Escrow Bar"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#16150E] hover:bg-[#242114] text-yellow-300 border border-yellow-500/30 font-mono text-xs transition-colors cursor-pointer ml-1"
        >
          <span>Minimize</span>
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
