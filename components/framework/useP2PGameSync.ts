import { useState, useCallback, useRef } from 'react';
import { GameWinMenuPayload } from './GameWinMenuModal.tsx';

export interface P2PGameSyncConfig {
  points: number;
  dailyPointsEarned: number;
  isP2PConnected: boolean;
  activeP2PPointBet: number;
  onCommitResult: (params: {
    gameType: string;
    summary: string;
    chipsDelta: number;
    outcome: 'win' | 'loss' | 'draw';
    statePayload: Record<string, unknown>;
  }) => void;
  onSyncP2PState: (gameType: string, state: Record<string, unknown>) => void;
}

/**
 * Reusable Framework Hook for P2P State Synchronization, Wager Escrow Settlement,
 * and Per-Game Victory Modal Orchestration across Card, Board, and Emulator Suites.
 */
export function useP2PGameSync(config: P2PGameSyncConfig) {
  const [winMenuPayload, setWinMenuPayload] = useState<GameWinMenuPayload | null>(null);
  const [playAgainCallback, setPlayAgainCallback] = useState<(() => void) | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  const broadcastMove = useCallback(
    (gameType: string, state: Record<string, unknown>) => {
      const current = configRef.current;
      current.onSyncP2PState(gameType, {
        ...state,
        syncedAt: Date.now(),
        p2pConnected: current.isP2PConnected,
      });
    },
    []
  );

  const triggerGameComplete = useCallback(
    (params: {
      gameId: string;
      gameTitle: string;
      gameTypeLedger: string;
      outcome: 'win' | 'loss' | 'draw' | 'completed';
      headline: string;
      subheadline: string;
      chipsDelta: number;
      stats: Array<{ label: string; value: string }>;
      statePayload?: Record<string, unknown>;
      onPlayAgain: () => void;
    }) => {
      const current = configRef.current;
      const ledgerOutcome: 'win' | 'loss' | 'draw' =
        params.outcome === 'completed' ? 'win' : params.outcome;

      const isWin = ledgerOutcome === 'win';
      const canEarnDailyPoint = isWin && current.dailyPointsEarned < 50;
      const p2pEscrowPayout =
        current.isP2PConnected && current.activeP2PPointBet > 0
          ? isWin
            ? current.activeP2PPointBet
            : ledgerOutcome === 'loss'
            ? -current.activeP2PPointBet
            : 0
          : 0;

      current.onCommitResult({
        gameType: params.gameTypeLedger,
        summary: `${params.gameTitle}: ${params.headline}`,
        chipsDelta: params.chipsDelta,
        outcome: ledgerOutcome,
        statePayload: params.statePayload || {},
      });

      setPlayAgainCallback(() => params.onPlayAgain);
      setWinMenuPayload({
        gameId: params.gameId,
        gameTitle: params.gameTitle,
        outcome: params.outcome,
        headline: params.headline,
        subheadline: params.subheadline,
        stats: params.stats,
        chipsDelta: params.chipsDelta,
        dailyPointAwarded: canEarnDailyPoint,
        dailyPointsEarned: canEarnDailyPoint
          ? Math.min(50, current.dailyPointsEarned + 1)
          : current.dailyPointsEarned,
        p2pEscrowPayout,
      });
    },
    []
  );

  const dismissWinMenu = useCallback(() => {
    setWinMenuPayload(null);
  }, []);

  const handlePlayAgain = useCallback(() => {
    if (playAgainCallback) {
      playAgainCallback();
    }
    setWinMenuPayload(null);
  }, [playAgainCallback]);

  return {
    winMenuPayload,
    broadcastMove,
    triggerGameComplete,
    dismissWinMenu,
    handlePlayAgain,
  };
}

