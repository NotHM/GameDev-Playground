// Pillar 2: Components — Top Bar Navigation & Low-Occlusion Perimeter HUD (Black & Yellow Theme)
import React from 'react';
import { Volume2, VolumeX, Maximize2, Trophy } from 'lucide-react';
import { nativeBridge } from '../app/nativeBindings.ts';

export type ActivePillarView = 'cards' | 'boards' | 'emulator' | 'profile';

interface TopBarProps {
  activeView: ActivePillarView;
  onSelectView: (v: ActivePillarView) => void;
  onOpenTitleShell: () => void;
  bankroll: number;
  points: number;
  dailyPointsEarned: number;
  peerCount: number;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const TopNavigationHud: React.FC<TopBarProps> = ({
  activeView,
  onSelectView,
  onOpenTitleShell,
  bankroll,
  points,
  dailyPointsEarned,
  peerCount,
  isMuted,
  onToggleMute,
}) => {
  const navItems: Array<{ id: ActivePillarView; label: string }> = [
    { id: 'cards', label: 'Card & Tarot Games' },
    { id: 'boards', label: 'Board Games' },
    { id: 'emulator', label: 'Emulator' },
    { id: 'profile', label: 'Profile & Leaderboard' },
  ];

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 md:gap-8 px-3 sm:px-6 h-[52px] sm:h-[56px] bg-[#070707]/95 backdrop-blur-md border-b border-yellow-500/30">
      {/* Zone 1: Brand Title */}
      <button
        type="button"
        onClick={onOpenTitleShell}
        className="text-sm sm:text-lg font-bold tracking-wider text-yellow-400 font-display whitespace-nowrap shrink-0 cursor-pointer hover:text-yellow-300 transition-colors min-h-[40px] flex items-center"
      >
        AETHERDECK
      </button>

      {/* Zone 2: 4 Single-line Navigation Links (horizontally scrollable on compact mobile) */}
      <nav className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-medium overflow-x-auto no-scrollbar py-1">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                nativeBridge.playSfx('move');
                onSelectView(item.id);
              }}
              className={`min-h-[38px] px-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                isActive
                  ? 'text-yellow-400 border-yellow-400 font-bold'
                  : 'text-neutral-400 border-transparent hover:text-yellow-200'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Primary Action & Compact Audio Toggle */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="hidden xl:flex items-center gap-2 text-xs text-neutral-300 font-mono tabular-nums">
          <span className="text-yellow-400 font-bold">{points} Pts ({dailyPointsEarned}/50)</span>
          <span aria-hidden="true">·</span>
          <span className="text-yellow-200 font-semibold">{bankroll.toLocaleString()} Chips</span>
          <span aria-hidden="true">·</span>
          <span className="text-neutral-400">{peerCount} Peers</span>
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          title={isMuted ? 'Unmute Audio Synth' : 'Mute Audio Synth'}
          className="min-w-[38px] min-h-[38px] flex items-center justify-center text-yellow-300 hover:text-yellow-200 bg-[#111111] border border-yellow-500/30 rounded-lg transition-colors cursor-pointer"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-yellow-400" />}
        </button>

        <button
          type="button"
          onClick={() => nativeBridge.toggleFullscreen()}
          title="Toggle Native Fullscreen"
          className="hidden md:inline-flex min-w-[38px] min-h-[38px] items-center justify-center text-yellow-300 hover:text-yellow-200 bg-[#111111] border border-yellow-500/30 rounded-lg transition-colors cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            nativeBridge.playSfx('move');
            onSelectView('profile');
          }}
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-bold text-black bg-yellow-400 hover:bg-yellow-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-[0_0_15px_rgba(250,204,21,0.25)]"
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Leaderboard ({points})</span>
        </button>
      </div>
    </header>
  );
};

