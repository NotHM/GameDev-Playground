import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Compass, Layers, CheckCircle2 } from 'lucide-react';

export type TutorialGameId =
  | 'shogi'
  | 'go'
  | 'corridor'
  | 'sudoku'
  | 'chess'
  | 'checkers'
  | 'reversi'
  | 'tarot'
  | 'solitaire'
  | 'draw_poker'
  | 'poker'
  | 'blackjack'
  | 'uno'
  | 'emulator';

interface TutorialStep {
  tabLabel: string;
  heading: string;
  explanation: string;
  bullets: string[];
}

interface GameTutorialDefinition {
  title: string;
  tagline: string;
  steps: TutorialStep[];
}

const TUTORIAL_LIBRARY: Record<TutorialGameId, GameTutorialDefinition> = {
  shogi: {
    title: 'Shogi (9×9 Japanese Chess · 将棋) — Interactive Tutorial',
    tagline: 'Master the 9×9 board, 3-rank Promotion Zone, and Komadai Captured Piece Drops.',
    steps: [
      {
        tabLabel: '1. Goal & 9×9 Setup',
        heading: 'Capture the Opponent King (Tsumi) on the 9×9 Grid',
        explanation:
          'You command Sente (bottom, cream pentagon tiles pointing upward). Your opponent commands Gote (top, dark tiles pointing downward). Unlike Western chess, captured pieces are never permanently removed—they join your reserve hand!',
        bullets: [
          'Each side starts with 20 pieces: 1 King (王), 1 Rook (飛), 1 Bishop (角), 2 Gold Generals (金), 2 Silver Generals (銀), 2 Knights (桂), 2 Lances (香), and 9 Pawns (歩).',
          'Pawns move and capture 1 square straight forward (not diagonally).',
          'Click any of your Sente pieces to highlight all legal destination squares in gold/green.',
        ],
      },
      {
        tabLabel: '2. Piece Vectors & Promotion',
        heading: 'Visual Movement Vectors & The 3-Rank Promotion Zone',
        explanation:
          'The top 3 rows of the board (Ranks 1–3) form your Promotion Zone. Moving a piece into, within, or out of these 3 rows promotes it automatically:',
        bullets: [
          'Silver (銀), Knight (桂), Lance (香), and Pawn (歩 → と Tokin) promote to move identically to a Gold General (金): 1 step orthogonally or 1 step forward-diagonally.',
          'Rook (飛) promotes to Dragon King (龍): slides infinitely orthogonally PLUS 1 step diagonally.',
          'Bishop (角) promotes to Dragon Horse (馬): slides infinitely diagonally PLUS 1 step orthogonally.',
        ],
      },
      {
        tabLabel: '3. Komadai Piece Drops',
        heading: 'Dropping Captured Pieces Back Onto the Board',
        explanation:
          'Every opponent piece you capture is demoted to its unpromoted side and placed on your Komadai (Hand Stand) below the board. On your turn, instead of moving a piece on the board, you can click a piece on your Komadai and drop it onto almost any empty square!',
        bullets: [
          'How to Drop: Click a button in the "Komadai" bar below the board, then click any empty square on the 9×9 grid.',
          'Nifu (Two-Pawn) Rule: You cannot drop an unpromoted Pawn (歩) onto a vertical column (file) that already contains one of your unpromoted Pawns.',
          'Drops can deliver immediate check or block an opponent Rook/Bishop attack!',
        ],
      },
    ],
  },
  go: {
    title: 'Go (Weiqi / Baduk · 囲碁) — Interactive Tutorial',
    tagline: 'Surround territory on grid intersections, count Liberties (Breaths), and capture stones.',
    steps: [
      {
        tabLabel: '1. Liberties & Chains',
        heading: 'Stones Live by Their Orthogonal Liberties (Breaths)',
        explanation:
          'Stones are placed on the intersections of the grid lines (9×9 for fast tactical games, 13×13 for balanced play, or 19×19 classic). Horizontally and vertically adjacent stones of the same color form a single connected Chain that shares all adjacent empty intersections (called Liberties).',
        bullets: [
          'A single stone in the center of the board has 4 Liberties (Up, Down, Left, Right).',
          'A stone on the edge has 3 Liberties; a stone in the corner has only 2 Liberties.',
          'Diagonal stones are NOT connected—only orthogonal (horizontal/vertical) links share liberties.',
        ],
      },
      {
        tabLabel: '2. Atari & Capture',
        heading: 'Removing the Last Liberty Captures the Entire Chain',
        explanation:
          'When an opponent stone or chain has only 1 Liberty remaining, it is in "Atari" (threat of immediate capture). Playing your stone on that final empty intersection removes its last breath and captures the entire chain as Prisoners!',
        bullets: [
          'Suicide Prohibition: You cannot play on an empty intersection that would leave your own stone with 0 Liberties—UNLESS that exact placement captures opponent stones first, creating new liberties.',
          'Ko Rule: Players cannot endlessly recapture a single stone back-and-forth to repeat the exact previous board position.',
        ],
      },
      {
        tabLabel: '3. Eyes & Territory Scoring',
        heading: 'Living Groups (Two Eyes) & Finishing a Match',
        explanation:
          'A chain of stones that encloses two separate empty intersections ("Two Eyes") can never be captured, because the opponent cannot fill either eye without committing illegal suicide! When boundaries are settled, click "Pass & Score Territory".',
        bullets: [
          'Komi (+6.5 Points): Because Black moves first, White receives +6.5 points of Komi compensation.',
          'Total Score = Stones/Territory on the Goban + Captured Prisoners (+6.5 Komi for White).',
        ],
      },
    ],
  },
  corridor: {
    title: 'Corridor (Quoridor 9×9 Maze) — Interactive Tutorial',
    tagline: 'Race your Pawn to the opposite baseline while placing 2-unit fences to detour your rival.',
    steps: [
      {
        tabLabel: '1. Race Objective & Turn Choice',
        heading: 'Reach Row 1 Before Your Opponent Reaches Row 9',
        explanation:
          'You start at the center of the bottom baseline (Row 9) with 10 Fences. Your opponent starts at the top baseline (Row 1) with 10 Fences. On each turn you must choose ONE action: either move your Pawn 1 square orthogonally OR place 1 Fence.',
        bullets: [
          'To Move Your Pawn: Click any highlighted gold/green square adjacent to your pawn.',
          'To Place a Fence: Choose "━ Horiz Fence" or "┃ Vert Fence" in the top bar, then click any "+" groove intersection between squares.',
          'Each fence spans exactly 2 squares and blocks pawns from crossing that edge.',
        ],
      },
      {
        tabLabel: '2. Pawn Jumping Rules',
        heading: 'Face-to-Face Straight Jumps & Diagonal Bypass',
        explanation:
          'When your pawn and the opponent pawn stand directly adjacent to each other with no fence between them, special jumping rules apply:',
        bullets: [
          'Straight Jump: If the square directly behind the opponent pawn is open and unblocked by a fence, you can leap straight over the opponent pawn (advancing 2 squares in 1 turn!).',
          'Diagonal Jump: If a fence or the edge of the board sits directly behind the opponent pawn, you may jump to either unblocked left/right side of the opponent pawn.',
        ],
      },
      {
        tabLabel: '3. Fair-Play BFS Wall Rule',
        heading: 'You Can Never Lock a Pawn Inside a Closed Box',
        explanation:
          'Fences are used to lengthen your opponent’s route, never to wall them off completely. Every fence placement is verified in real time using Breadth-First Search (BFS):',
        bullets: [
          'Both players must always have at least 1 valid open path to their goal baseline.',
          'Watch the live "Shortest Path (BFS)" counter in the sidebar—place fences that add +2 to +4 steps to your opponent’s route without slowing your own path!',
        ],
      },
    ],
  },
  sudoku: {
    title: 'Sudoku (9×9 Logic Grid · 数独) — Interactive Tutorial',
    tagline: 'Deduce every cell from 1 to 9 using Row, Column, and 3×3 Box elimination.',
    steps: [
      {
        tabLabel: '1. The Three Golden Rules',
        heading: 'Zero Repetition Across Rows, Columns, and 3×3 Subgrids',
        explanation:
          'Sudoku requires pure logical deduction—never guessing. Every cell in the 9×9 grid must hold a digit from 1 to 9 such that:',
        bullets: [
          'Every Horizontal Row contains all digits 1, 2, 3, 4, 5, 6, 7, 8, 9 without duplicates.',
          'Every Vertical Column contains all digits 1 through 9 without duplicates.',
          'Every bold-outlined 3×3 Box contains all digits 1 through 9 without duplicates.',
        ],
      },
      {
        tabLabel: '2. Cross-Hatching & Pencil Notes',
        heading: 'How to Spot Hidden Singles & Use Pencil Candidates',
        explanation:
          'Scan a 3×3 box for a specific number (e.g., 7). Trace the rows and columns containing 7s in neighboring boxes to cross out forbidden cells until only one cell remains!',
        bullets: [
          'Pencil Notes Mode: Toggle "Notes ON" below the grid to jot small candidate numbers inside any cell before committing.',
          'Conflict Detection: If a digit duplicates another digit in the same row, column, or 3×3 box, the cell highlights immediately so you can correct it.',
        ],
      },
      {
        tabLabel: '3. Smart Hints & Completion',
        heading: 'Using Verified Deductions & Earning Daily Win Points',
        explanation:
          'Stuck on a Hard grid? Select any editable cell and click "Hint" to reveal the verified solution digit for that coordinate.',
        bullets: [
          'Completing all 81 cells without conflicts triggers the Sudoku Victory Modal and awards +200 Chips and +1 Daily Win Point.',
        ],
      },
    ],
  },
  chess: {
    title: 'Classical Chess (8×8 FIDE) — Interactive Tutorial',
    tagline: 'Command all 6 piece archetypes, Castle for King safety, and deliver Checkmate.',
    steps: [
      {
        tabLabel: '1. Piece Movement',
        heading: 'Orthogonal, Diagonal, and Knight L-Jump Vectors',
        explanation:
          'Click any of your gold pieces to illuminate every legal destination square on the 8×8 board.',
        bullets: [
          'King (♔): 1 square any direction + Castling (move King 2 squares toward unmoved Rook).',
          'Queen (♕): Slides any distance along ranks, files, or diagonals.',
          'Rook (♖) & Bishop (♗): Rook slides horizontally/vertically; Bishop slides diagonally.',
          'Knight (♘): Jumps in a 2×1 L-shape over intervening pieces.',
        ],
      },
      {
        tabLabel: '2. Special Rules & Tactics',
        heading: 'Pawn Promotion, Castling & Center Control',
        explanation:
          'Pawns advance 2 squares from their starting rank (1 thereafter), capture diagonally, and automatically promote to a Queen (♕) upon reaching the 8th rank.',
        bullets: [
          'Control the central 4 squares (d4, d5, e4, e5) early and castle to protect your King.',
        ],
      },
    ],
  },
  checkers: {
    title: 'Checkers (8×8 Draughts) — Interactive Tutorial',
    tagline: 'Diagonal dark-square leaps and King crowning.',
    steps: [
      {
        tabLabel: '1. Movement & Jumps',
        heading: 'Diagonal Steps & Capturing Jumps',
        explanation:
          'Pieces move 1 square diagonally forward on dark squares, or jump over an adjacent opponent piece into an empty square directly beyond it.',
        bullets: [
          'Reaching Row 1 crowns your piece into a King (♔) capable of moving and jumping both forward and backward.',
        ],
      },
    ],
  },
  reversi: {
    title: 'Reversi (Othello 8×8) — Interactive Tutorial',
    tagline: 'Outflank opponent discs along straight lines and lock down the 4 corners.',
    steps: [
      {
        tabLabel: '1. Outflanking & Corners',
        heading: 'Bracketing Opponent Discs & Corner Control',
        explanation:
          'Each square badge (+1, +2, +3) shows how many opponent discs will flip to gold if you place a disc there. Corner squares can never be outflanked!',
        bullets: [
          'Secure the 4 corners (a1, h1, a8, h8) to anchor entire edges of the board.',
        ],
      },
    ],
  },
  tarot: {
    title: '78-Card Rider-Waite-Smith Tarot & Astrology — Esoteric Guide',
    tagline: 'Natal Sun-Moon-Rising Triad, 12 Astrological Houses, and Elemental Dignities.',
    steps: [
      {
        tabLabel: '1. Natal Chart Triad',
        heading: 'Configure Your Sun, Moon & Rising Signs',
        explanation:
          'Your reading resonates with your full Astrological Natal Triad: Sun Sign (core essence & conscious will), Moon Sign (emotional instincts & inner mystery), and Rising / Ascendant Sign (destiny path & outer horizon).',
        bullets: [
          'Cards sharing an element or planetary ruler with your Sun, Moon, or Rising sign trigger bonus Celestial Resonance!',
          'Reversed Cards rotate only their central symbolic artwork while keeping all text and planetary rulers upright for effortless reading.',
        ],
      },
      {
        tabLabel: '2. Elemental Dignities',
        heading: 'How Adjacent Cards Strengthen or Challenge Each Other',
        explanation:
          'In classical Golden Dawn & Rider-Waite tarot, cards placed side-by-side interact through their Elements (Fire 🜂, Water 🜄, Air 🜁, Earth 🜃):',
        bullets: [
          'Friendly & Strengthening: Fire + Air (Wind fans the Flame) and Water + Earth (Rain nourishes the Soil).',
          'Harmonious Resonance: Two cards of the exact same Element amplify that domain.',
          'Complementary / Neutral: Fire + Earth or Water + Air balance practical and intuitive forces.',
          'Contrary Tension: Fire + Water (Steam) or Air + Earth require conscious synthesis.',
        ],
      },
      {
        tabLabel: '3. Four Oracle Modes',
        heading: '3-Card Destiny, 5-Card Celtic Cross, 12 Houses & Trial of Fate',
        explanation:
          'Choose from 4 complete oracle experiences: 3-Card Past·Present·Future, 5-Card Celtic Cross, the 12 Astrological Houses Wheel Spread, or the interactive Celestial Trial of Fate.',
        bullets: [
          'Click any revealed card to inspect its deep upright/reversed grimoire meaning, Numerology, Kabbalistic Decan, and Natal Triad synergy.',
        ],
      },
    ],
  },
  solitaire: {
    title: 'Klondike Solitaire — Interactive Guide',
    tagline: 'Build all 4 Suit Foundations from Ace (A) to King (K).',
    steps: [
      {
        tabLabel: '1. Tableau & Foundations',
        heading: 'Alternating Colors Downward, Same Suit Upward',
        explanation:
          'Stack Tableau columns downward (K → Q → J → 10 ... → 2 → A) alternating Red (♥/♦) and Black (♠/♣). Build the 4 Suit Foundations upward by suit from Ace (A = 1) through King (K = 13).',
        bullets: [
          'Quick Promote: Click "Auto-Promote to Foundations" anytime or double-click an exposed card to send it straight to its Suit Foundation!',
        ],
      },
    ],
  },
  draw_poker: {
    title: '5-Card Draw Poker — Interactive Guide',
    tagline: 'Ante up, toggle cards to HOLD or Mulligan/Redraw, and out-rank your rival at Showdown.',
    steps: [
      {
        tabLabel: '1. Hold & Mulligan Draw',
        heading: 'Select Cards to HOLD · Discard & Redraw the Rest',
        explanation:
          'You and your rival are each dealt 5 private cards. Toggle any cards in your hand to HOLD (gold lock badge), then execute your Mulligan Draw to toss unheld cards into the discard stack and draw fresh replacements!',
        bullets: [
          'Drag or tap cards to toggle HOLD, inspect keyword tooltips via hover/loupe, and raise the pot before Showdown.',
          'Standard 5-card rankings apply: Royal Flush, Straight Flush, Four of a Kind, Full House, Flush, Straight, Three of a Kind, Two Pair, One Pair, High Card.',
        ],
      },
    ],
  },
  poker: {
    title: 'Texas Hold’em Poker — Interactive Guide',
    tagline: '2 Hole Cards + 5 Community Cards across Pre-Flop, Flop, Turn, and River.',
    steps: [
      {
        tabLabel: '1. Streets & Hand Ranks',
        heading: 'Betting Streets & 5-Card Hand Hierarchy',
        explanation:
          'Combine your 2 Hole Cards with the 5 Community Cards to form the best 5-card hand (Royal Flush down to High Card).',
        bullets: [
          'Check/Call advances the street cautiously; Raise +50/+100 builds the pot when holding strong equity.',
        ],
      },
    ],
  },
  blackjack: {
    title: 'Casino Blackjack 21 — Interactive Guide',
    tagline: 'Reach 21 without busting; Natural Blackjack pays 3:2.',
    steps: [
      {
        tabLabel: '1. Hit, Stand & Double',
        heading: 'Dealer Stands on 17 · Aces Count as 11 or 1',
        explanation:
          'Double Down on strong 2-card totals (10 or 11) to double your wager for 1 final card.',
        bullets: ['Natural 21 on initial deal pays 3:2 immediately and awards +1 Daily Point.'],
      },
    ],
  },
  uno: {
    title: 'UNO Competitive Shedding — Interactive Guide',
    tagline: 'Match color or symbol, chain Skip/+2 actions, and empty your hand.',
    steps: [
      {
        tabLabel: '1. Color & Action Matching',
        heading: 'Shed Every Card & Call UNO at 1 Card Left',
        explanation:
          'Play a card matching the active color or rank, or drop a Wild / +4 to switch the active suit color.',
        bullets: ['Skip and Reverse grant an immediate extra turn in 1v1 play!'],
      },
    ],
  },
  emulator: {
    title: 'Retro Arcade & Wasm Emulator — Controls & ROM Guide',
    tagline: 'Focus-safe keyboard/gamepad controls, 5 built-in vector/arcade ROMs, and custom ROM uploads.',
    steps: [
      {
        tabLabel: '1. Controls & Asteroid Vector DX',
        heading: 'Focus-Safe Spacebar Fire & Thrust Physics',
        explanation:
          'Pressing Space strictly fires weapons (plasma bolts in Asteroid Vector DX, lasers in Space Invaders, shells in Vector Tank) without ever triggering browser button resets.',
        bullets: [
          'Left / Right Arrows (or A / D): Rotate ship or move paddle.',
          'Up Arrow (or W): Engage main thrusters in Asteroid Vector DX.',
          'Spacebar: Fire plasma cannon / launch ball.',
          'Enter or R Key: Restart after Game Over.',
        ],
      },
    ],
  },
};

interface MinimizableTutorialProps {
  gameId: TutorialGameId;
  defaultMinimized?: boolean;
}

export const MinimizableTutorial: React.FC<MinimizableTutorialProps> = ({
  gameId,
  defaultMinimized = false,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(defaultMinimized);
  const [activeStepIdx, setActiveStepIdx] = useState<number>(0);
  const [selectedShogiPiece, setSelectedShogiPiece] = useState<
    'K' | 'R' | 'B' | 'G' | 'S' | 'N' | 'L' | 'P'
  >('G');

  const spec = TUTORIAL_LIBRARY[gameId];
  const safeStepIdx = Math.min(activeStepIdx, spec.steps.length - 1);
  const activeStep = spec.steps[safeStepIdx];

  // Visual piece diagram helper for Shogi
  const renderShogiPieceVectorDiagram = () => {
    const pieceConfigs: Record<
      'K' | 'R' | 'B' | 'G' | 'S' | 'N' | 'L' | 'P',
      {
        title: string;
        kanji: string;
        note: string;
        steps: Array<[number, number]>;
        slides: Array<[number, number]>;
      }
    > = {
      K: {
        title: 'King (王将)',
        kanji: '王',
        note: 'Steps 1 square in all 8 directions.',
        steps: [
          [-1, -1], [-1, 0], [-1, 1],
          [0, -1],           [0, 1],
          [1, -1],  [1, 0],  [1, 1],
        ],
        slides: [],
      },
      G: {
        title: 'Gold General (金将) & Promoted +S/+N/+L/+P',
        kanji: '金',
        note: 'Steps 1 square orthogonally or forward-diagonally (cannot step backward-diagonally).',
        steps: [
          [-1, -1], [-1, 0], [-1, 1],
          [0, -1],           [0, 1],
                    [1, 0],
        ],
        slides: [],
      },
      S: {
        title: 'Silver General (銀将)',
        kanji: '銀',
        note: 'Steps 1 square forward or in any of the 4 diagonal directions (promotes to Gold).',
        steps: [
          [-1, -1], [-1, 0], [-1, 1],
          [1, -1],           [1, 1],
        ],
        slides: [],
      },
      N: {
        title: 'Knight (桂馬)',
        kanji: '桂',
        note: 'Jumps 2 squares forward and 1 square left or right (only forward L-jumps; promotes to Gold).',
        steps: [
          [-2, -1], [-2, 1],
        ],
        slides: [],
      },
      L: {
        title: 'Lance (香車)',
        kanji: '香',
        note: 'Slides any number of empty squares straight forward (promotes to Gold).',
        steps: [],
        slides: [[-1, 0], [-2, 0]],
      },
      R: {
        title: 'Rook (飛車) / Promoted Dragon (龍)',
        kanji: '飛',
        note: 'Slides infinitely along ranks & files. When promoted to Dragon (龍), also steps 1 square diagonally!',
        steps: [],
        slides: [
          [-1, 0], [-2, 0], [1, 0], [2, 0],
          [0, -1], [0, -2], [0, 1], [0, 2],
        ],
      },
      B: {
        title: 'Bishop (角行) / Promoted Horse (馬)',
        kanji: '角',
        note: 'Slides infinitely along diagonals. When promoted to Horse (馬), also steps 1 square orthogonally!',
        steps: [],
        slides: [
          [-1, -1], [-2, -2], [-1, 1], [-2, 2],
          [1, -1], [2, -2], [1, 1], [2, 2],
        ],
      },
      P: {
        title: 'Pawn (歩兵) / Promoted Tokin (と)',
        kanji: '歩',
        note: 'Steps and captures 1 square straight forward. Promotes to Tokin (と), which moves like Gold!',
        steps: [[-1, 0]],
        slides: [],
      },
    };

    const current = pieceConfigs[selectedShogiPiece];

    return (
      <div className="p-4 rounded-xl bg-[#0D0C08] border border-yellow-500/30 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-mono uppercase text-yellow-400 font-bold">
            Interactive Shogi Piece Movement Diagram (Click Piece to Inspect):
          </span>
          <div className="flex flex-wrap gap-1">
            {(['G', 'S', 'N', 'L', 'R', 'B', 'P', 'K'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSelectedShogiPiece(k)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border cursor-pointer transition-colors ${
                  selectedShogiPiece === k
                    ? 'bg-yellow-400 text-black border-yellow-200'
                    : 'bg-[#16150E] text-yellow-100 border-yellow-500/25 hover:border-yellow-400'
                }`}
              >
                {pieceConfigs[k].kanji} {k}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-5">
          {/* 5x5 Visual Grid */}
          <div className="grid grid-cols-5 border border-yellow-500/40 rounded-lg overflow-hidden bg-[#18150C] shrink-0">
            {Array.from({ length: 5 }).map((_, r) =>
              Array.from({ length: 5 }).map((__, c) => {
                const dr = r - 2;
                const dc = c - 2;
                const isCenter = dr === 0 && dc === 0;
                const isStep = current.steps.some(([sr, sc]) => sr === dr && sc === dc);
                const isSlide = current.slides.some(([sr, sc]) => sr === dr && sc === dc);

                return (
                  <div
                    key={`${r}-${c}`}
                    className={`w-9 h-9 border border-yellow-500/15 flex items-center justify-center text-xs font-mono ${
                      isCenter
                        ? 'bg-yellow-400 text-black font-bold'
                        : isStep
                        ? 'bg-yellow-400/30 text-yellow-200 font-bold'
                        : isSlide
                        ? 'bg-amber-500/25 text-amber-300 font-bold'
                        : 'text-neutral-600'
                    }`}
                  >
                    {isCenter ? current.kanji : isStep ? '●' : isSlide ? '↑' : '·'}
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-1.5 text-xs sm:text-sm text-yellow-100">
            <div className="font-bold text-yellow-300 text-base">{current.title}</div>
            <p className="text-neutral-200 leading-relaxed">{current.note}</p>
            <div className="flex items-center gap-4 text-xs font-mono text-yellow-300/90 pt-1">
              <span>● = 1-Square Step / Jump</span>
              <span>↑ = Multi-Square Slide</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Visual diagram for Go Liberties & Capture
  const renderGoVisualDiagram = () => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#0D0C08] border border-yellow-500/30 text-xs">
      <div className="p-3 rounded-lg bg-[#14120B] border border-yellow-500/20 space-y-1.5">
        <div className="font-bold text-yellow-400 font-mono">1. Four Liberties (Breaths)</div>
        <pre className="font-mono text-yellow-200 text-xs leading-tight bg-black/50 p-2 rounded">
{`  ·  ○  ·
  ○  ●  ○
  ·  ○  ·`}
        </pre>
        <p className="text-neutral-200">
          Black stone (●) has 4 adjacent empty intersections (○ = Liberties).
        </p>
      </div>

      <div className="p-3 rounded-lg bg-[#14120B] border border-yellow-500/20 space-y-1.5">
        <div className="font-bold text-yellow-400 font-mono">2. Atari &amp; Capture</div>
        <pre className="font-mono text-yellow-200 text-xs leading-tight bg-black/50 p-2 rounded">
{`  ·  ●  ·
  ●  ◯  !
  ·  ●  ·`}
        </pre>
        <p className="text-neutral-200">
          White stone (◯) has only 1 liberty left (!). Black playing on (!) captures ◯!
        </p>
      </div>

      <div className="p-3 rounded-lg bg-[#14120B] border border-yellow-500/20 space-y-1.5">
        <div className="font-bold text-yellow-400 font-mono">3. Living Group (2 Eyes)</div>
        <pre className="font-mono text-yellow-200 text-xs leading-tight bg-black/50 p-2 rounded">
{` ● ● ● ● ●
 ● ○ ● ○ ●
 ● ● ● ● ●`}
        </pre>
        <p className="text-neutral-200">
          Two separate inner liberties (○) make a group immortal and uncapturable.
        </p>
      </div>
    </div>
  );

  // Visual diagram for Corridor Jumps & Fence BFS
  const renderCorridorVisualDiagram = () => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#0D0C08] border border-yellow-500/30 text-xs">
      <div className="p-3 rounded-lg bg-[#14120B] border border-yellow-500/20 space-y-1.5">
        <div className="font-bold text-yellow-400 font-mono">1. Straight Pawn Jump</div>
        <pre className="font-mono text-yellow-200 text-xs leading-tight bg-black/50 p-2 rounded">
{`  [ ★ ]  ← Land Here!
  [P2 ]  ← Jump Over
  [YOU]`}
        </pre>
        <p className="text-neutral-200">
          When face-to-face with no fence between, leap straight over P2!
        </p>
      </div>

      <div className="p-3 rounded-lg bg-[#14120B] border border-yellow-500/20 space-y-1.5">
        <div className="font-bold text-yellow-400 font-mono">2. Diagonal Wall Bypass</div>
        <pre className="font-mono text-yellow-200 text-xs leading-tight bg-black/50 p-2 rounded">
{` ═══════ ← Fence Behind
 [★][P2][★]
    [YOU]`}
        </pre>
        <p className="text-neutral-200">
          If a fence blocks behind P2, you can jump diagonally left or right (★).
        </p>
      </div>

      <div className="p-3 rounded-lg bg-[#14120B] border border-yellow-500/20 space-y-1.5">
        <div className="font-bold text-yellow-400 font-mono">3. Fair-Play BFS Path</div>
        <pre className="font-mono text-yellow-200 text-xs leading-tight bg-black/50 p-2 rounded">
{` ▲ Goal Row 1 Open
 ═══   ═════ (Gap Left)
    [YOU]`}
        </pre>
        <p className="text-neutral-200">
          Fences slow rivals down, but must always leave at least 1 open path to the goal.
        </p>
      </div>
    </div>
  );

  // Visual diagram for Sudoku Cross-Hatching
  const renderSudokuVisualDiagram = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#0D0C08] border border-yellow-500/30 text-xs">
      <div className="p-3 rounded-lg bg-[#14120B] border border-yellow-500/20 space-y-1.5">
        <div className="font-bold text-yellow-400 font-mono">Cross-Hatching Elimination</div>
        <p className="text-neutral-200 leading-relaxed">
          If Row 1 and Row 2 already contain a <strong className="text-yellow-300">9</strong>, then inside the top-right 3×3 box, <strong className="text-yellow-300">9</strong> can ONLY go in Row 3!
        </p>
      </div>
      <div className="p-3 rounded-lg bg-[#14120B] border border-yellow-500/20 space-y-1.5">
        <div className="font-bold text-yellow-400 font-mono">Pencil Notes (Candidate Tracking)</div>
        <p className="text-neutral-200 leading-relaxed">
          Turn on <strong className="text-yellow-300">Notes ON</strong> to mark possible numbers (e.g. <span className="font-mono text-yellow-300">2, 6</span>) inside empty cells. When only 1 note remains in a cell, lock it in!
        </p>
      </div>
    </div>
  );

  if (isMinimized) {
    return (
      <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-[#100F0A] border border-yellow-500/35 rounded-xl">
        <div className="flex items-center gap-2.5 text-xs sm:text-sm">
          <BookOpen className="w-4 h-4 text-yellow-400 shrink-0" />
          <span className="font-bold text-yellow-300 font-display">{spec.title}</span>
          <span className="hidden md:inline text-neutral-300">· {spec.tagline}</span>
        </div>

        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-mono font-bold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>Expand Tutorial</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#11100A] border border-yellow-500/45 p-5 space-y-4 shadow-lg">
      {/* Header & Minimize Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-yellow-500/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-yellow-400/15 border border-yellow-400/40 flex items-center justify-center text-yellow-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-yellow-300 font-display">{spec.title}</h3>
            <p className="text-xs text-neutral-300">{spec.tagline}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Step Tabs */}
          {spec.steps.length > 1 && (
            <div className="flex flex-wrap items-center gap-1 bg-[#090906] p-1 rounded-xl border border-yellow-500/25">
              {spec.steps.map((st, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveStepIdx(idx)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    safeStepIdx === idx
                      ? 'bg-yellow-400 text-black'
                      : 'text-neutral-300 hover:text-yellow-300'
                  }`}
                >
                  {st.tabLabel}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#18160E] hover:bg-[#252214] text-yellow-300 border border-yellow-500/35 text-xs font-mono font-semibold transition-colors cursor-pointer"
          >
            <span>Minimize Tutorial</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Active Step Content */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-yellow-100">
          <Layers className="w-4 h-4 text-yellow-400 shrink-0" />
          <span>{activeStep.heading}</span>
        </div>

        <p className="text-sm sm:text-base text-yellow-50/90 leading-relaxed">
          {activeStep.explanation}
        </p>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
          {activeStep.bullets.map((b, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 p-3 rounded-xl bg-[#0B0A07] border border-yellow-500/20 text-xs sm:text-sm text-neutral-100 leading-relaxed"
            >
              <CheckCircle2 className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Interactive Visual Diagrams for Shogi, Go, Corridor, and Sudoku */}
      {gameId === 'shogi' && renderShogiPieceVectorDiagram()}
      {gameId === 'go' && renderGoVisualDiagram()}
      {gameId === 'corridor' && renderCorridorVisualDiagram()}
      {gameId === 'sudoku' && renderSudokuVisualDiagram()}
    </div>
  );
};
