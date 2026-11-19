import React from 'react';
import { Trophy, RotateCcw, Award, Coins, ShieldCheck, Sparkles, X, ArrowRight } from 'lucide-react';

export interface GameWinStat {
  label: string;
  value: string;
}

export interface GameWinMenuPayload {
  gameId: string;
  gameTitle: string;
  outcome: 'win' | 'loss' | 'draw' | 'completed';
  headline: string;
  subheadline: string;
  stats: GameWinStat[];
  chipsDelta: number;
  dailyPointAwarded: boolean;
  dailyPointsEarned: number;
  p2pEscrowPayout?: number;
}

interface GameWinMenuModalProps {
  payload: GameWinMenuPayload | null;
  onPlayAgain: () => void;
  onDismiss: () => void;
  switchGameOptions?: Array<{ id: string; label: string }>;
  onSwitchGame?: (gameId: string) => void;
}

export const GameWinMenuModal: React.FC<GameWinMenuModalProps> = ({
  payload,
  onPlayAgain,
  onDismiss,
  switchGameOptions,
  onSwitchGame,
}) => {
  if (!payload) return null;

  const isPositive = payload.outcome === 'win' || payload.outcome === 'completed';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="win-modal-title"
    >
      <div className="relative w-full max-w-xl rounded-2xl bg-[#0B0A07] border-2 border-yellow-400 shadow-[0_0_50px_rgba(250,204,21,0.28)] overflow-hidden">
        {/* Top Accent Banner */}
        <div className="px-6 py-5 bg-gradient-to-r from-[#1C1808] via-[#131108] to-[#1C1808] border-b border-yellow-500/30 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-yellow-400 text-black flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.5)] shrink-0">
              {isPositive ? <Trophy className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-yellow-400 font-bold">
                {payload.gameTitle} · Match Complete Menu
              </div>
              <h2
                id="win-modal-title"
                className="text-2xl font-bold text-yellow-50 font-display tracking-tight mt-0.5"
              >
                {payload.headline}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="p-2 rounded-lg bg-[#16150E] hover:bg-yellow-400 hover:text-black text-yellow-200 border border-yellow-500/30 transition-colors cursor-pointer"
            title="Inspect Board / Close Menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          <p className="text-sm sm:text-base text-yellow-100/95 leading-relaxed bg-[#12110B] border border-yellow-500/25 rounded-xl p-4">
            {payload.subheadline}
          </p>

          {/* Rewards & Escrow Ledger Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-[#14120A] border border-yellow-500/35 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-xs font-mono text-yellow-300/90">
                <Coins className="w-3.5 h-3.5 text-yellow-400" />
                <span>CHIP PAYOUT</span>
              </div>
              <div
                className={`text-xl font-mono font-bold tabular-nums mt-1 ${
                  payload.chipsDelta >= 0 ? 'text-yellow-400' : 'text-amber-500'
                }`}
              >
                {payload.chipsDelta >= 0 ? `+${payload.chipsDelta.toLocaleString()}` : payload.chipsDelta.toLocaleString()}{' '}
                Chips
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#14120A] border border-yellow-500/35 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-xs font-mono text-yellow-300/90">
                <Award className="w-3.5 h-3.5 text-yellow-400" />
                <span>DAILY WIN POINT</span>
              </div>
              <div className="text-base font-mono font-bold text-yellow-100 tabular-nums mt-1">
                {payload.dailyPointAwarded
                  ? `+1 Pt (${Math.min(50, payload.dailyPointsEarned)}/50)`
                  : `Cap ${payload.dailyPointsEarned}/50 Today`}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#14120A] border border-yellow-500/35 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-xs font-mono text-yellow-300/90">
                <ShieldCheck className="w-3.5 h-3.5 text-yellow-400" />
                <span>P2P ESCROW</span>
              </div>
              <div className="text-base font-mono font-bold text-yellow-300 tabular-nums mt-1">
                {payload.p2pEscrowPayout && payload.p2pEscrowPayout !== 0
                  ? `${payload.p2pEscrowPayout > 0 ? '+' : ''}${payload.p2pEscrowPayout} Pts Settled`
                  : 'Local Ledger Verified'}
              </div>
            </div>
          </div>

          {/* Per-Game Specific Telemetry & Performance Breakdown */}
          {payload.stats.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-mono uppercase tracking-wider text-yellow-400/90 font-semibold">
                Game-Specific Match Telemetry
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {payload.stats.map((st, idx) => (
                  <div
                    key={idx}
                    className="px-3.5 py-2.5 rounded-xl bg-[#100F0A] border border-yellow-500/20 flex flex-col"
                  >
                    <span className="text-xs text-neutral-300">{st.label}</span>
                    <span className="text-sm font-mono font-bold text-yellow-200 mt-0.5 tabular-nums">
                      {st.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Primary Rematch / Inspect Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-yellow-500/20">
            <button
              type="button"
              onClick={() => {
                onPlayAgain();
              }}
              className="flex-1 min-w-[180px] flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-sm shadow-[0_0_20px_rgba(250,204,21,0.35)] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Play Again ({payload.gameTitle})</span>
            </button>

            <button
              type="button"
              onClick={onDismiss}
              className="px-4 py-3 rounded-xl bg-[#16150E] hover:bg-[#222015] text-yellow-100 border border-yellow-500/35 font-semibold text-sm transition-colors cursor-pointer"
            >
              Inspect Board / Table
            </button>
          </div>

          {/* Optional Quick Switch to Another Game in the Suite */}
          {switchGameOptions && switchGameOptions.length > 0 && onSwitchGame && (
            <div className="pt-2 space-y-2">
              <div className="text-xs font-mono text-neutral-300 flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5 text-yellow-400" />
                <span>Or switch directly to another game in this arena:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {switchGameOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onDismiss();
                      onSwitchGame(opt.id);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#13120C] hover:bg-yellow-400 hover:text-black text-yellow-200 border border-yellow-500/25 transition-colors cursor-pointer"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
