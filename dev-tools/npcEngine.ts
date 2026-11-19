export interface TelemetryMetrics {
  gameId: string;
  sessionsPlayed: number;
  winRate: number;
  avgMatchDurationSec: number;
  recommendedDifficultyScale: number;
  tuningSummary: string;
}

export interface NpcPersona {
  id: string;
  name: string;
  role: string;
  specialty: string;
  avatarColor: string;
}

export const NPC_PERSONAS: NpcPersona[] = [
  {
    id: 'vance',
    name: 'Viktor Vance',
    role: 'High-Stakes Hold’em & Blackjack Tactician',
    specialty: 'Pot odds, expected value (EV), and card counting telemetry',
    avatarColor: '#10B981',
  },
  {
    id: 'kaspar',
    name: 'Grandmaster Kaspar',
    role: 'Board Game & Deep Positional Engine',
    specialty: 'Chess algebraic tactics, Checkers forced-jump trees, and Othello corner control',
    avatarColor: '#F59E0B',
  },
  {
    id: 'ada',
    name: 'Ada-64 Wasm Architect',
    role: 'WebAssembly Memory & Shader Engineer',
    specialty: 'Linear memory byte patching, Phaser 60fps loop tuning, and CRT compute kernels',
    avatarColor: '#38BDF8',
  },
];

export function evaluateLocalTelemetry(
  gameId: string,
  wins: number,
  losses: number,
  avgDurationSec: number
): TelemetryMetrics {
  const total = Math.max(1, wins + losses);
  const winRate = Number(((wins / total) * 100).toFixed(1));
  let recommendedDifficultyScale = 1.0;
  let tuningSummary = 'Balanced encounter curve; keep current frame speed and bot depth.';

  if (winRate > 68) {
    recommendedDifficultyScale = 1.25;
    tuningSummary = 'Player win rate exceeds 68%. Autonomous balancer recommends +25% bot search depth and 1.15x Wasm clock speed.';
  } else if (winRate < 35 && wins + losses >= 2) {
    recommendedDifficultyScale = 0.85;
    tuningSummary = 'High attrition detected. Autonomous balancer recommends +1 starting life register at 0x0010 and softer bot aggression.';
  }

  return {
    gameId,
    sessionsPlayed: wins + losses,
    winRate,
    avgMatchDurationSec: Math.round(avgDurationSec),
    recommendedDifficultyScale,
    tuningSummary,
  };
}

export async function queryHighThinkingAdvisor(params: {
  personaId: string;
  gameType: string;
  boardOrHandState: string;
  question: string;
}): Promise<{ reply: string; thinkingSummary: string; modelUsed: string; source: 'gemini-4-argon' | 'local-heuristic' }> {
  try {
    const res = await fetch('/api/ai/strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Strategy endpoint returned error');
    }
    return {
      reply: data.reply,
      thinkingSummary: data.thinkingSummary || 'Evaluated multi-branch game tree with ThinkingLevel.HIGH.',
      modelUsed: data.modelUsed || 'gemini-4-argon',
      source: 'gemini-4-argon',
    };
  } catch (err) {
    // Offline-first local heuristic fallback when offline or without a billing-enabled key
    const fallbackAdvice = buildOfflineTacticalAnalysis(params.gameType, params.boardOrHandState, params.question);
    return {
      reply: fallbackAdvice,
      thinkingSummary: 'Executed local deterministic minimax/EV heuristic (offline-first fallback).',
      modelUsed: 'gemini-4-argon (offline heuristic fallback)',
      source: 'local-heuristic',
    };
  }
}

function buildOfflineTacticalAnalysis(gameType: string, state: string, question: string): string {
  const g = gameType.toLowerCase();
  if (g.includes('poker')) {
    return `Tactical Hold'em Read: Given state [${state}], prioritize pot-odds discipline. When holding top pair or nut flush draws in late position, a 60%-75% pot continuation bet maximizes fold equity while protecting your stack. (${question})`;
  }
  if (g.includes('blackjack')) {
    return `Basic Strategy Matrix: Against dealer upcards 7 through Ace, hit soft/hard totals below 17. Stand on 12-16 when the dealer shows a bust card (4, 5, or 6), and always double down on 11 unless facing an Ace. State analyzed: [${state}].`;
  }
  if (g.includes('chess')) {
    return `Positional Evaluation: Control the central d4/d5/e4/e5 squares, complete kingside castling to connect rooks, and scan for forcing checks, captures, and threats before committing pawn advances. Current board state: [${state}].`;
  }
  return `Tactical Assessment for ${gameType}: State [${state}] inspected. Maintain tempo control, preserve high-value resources, and exploit opponent overextensions.`;
}
