import React, { useState, useMemo } from 'react';
import { nativeBridge } from '../../app/nativeBindings.ts';
import { MinimizableEscrowBar } from '../framework/MinimizableEscrowBar.tsx';
import { MinimizableTutorial } from '../framework/MinimizableTutorial.tsx';
import { GameWinMenuModal } from '../framework/GameWinMenuModal.tsx';
import { useP2PGameSync } from '../framework/useP2PGameSync.ts';
import { RotateCcw, Sparkles, CheckCircle2, Trophy } from 'lucide-react';

export type BoardGameMode = 'corridor' | 'shogi' | 'go' | 'sudoku' | 'chess' | 'checkers' | 'reversi';

interface BoardGamesViewProps {
  points: number;
  dailyPointsEarned: number;
  isP2PConnected: boolean;
  activeP2PPointBet: number;
  onPlaceP2PPointBet: (stake: number) => void;
  onCommitResult: (params: {
    gameType: string;
    summary: string;
    chipsDelta: number;
    outcome: 'win' | 'loss' | 'draw';
    statePayload: Record<string, unknown>;
  }) => void;
  onSyncP2PState: (gameType: string, state: Record<string, unknown>) => void;
}

const BOARD_GAME_TABS: Array<{ id: BoardGameMode; label: string }> = [
  { id: 'corridor', label: 'Corridor (9×9 Maze)' },
  { id: 'shogi', label: 'Shogi (将棋 9×9)' },
  { id: 'go', label: 'Go (囲碁)' },
  { id: 'sudoku', label: 'Sudoku (数独)' },
  { id: 'chess', label: 'Chess' },
  { id: 'checkers', label: 'Checkers' },
  { id: 'reversi', label: 'Reversi' },
];

// ==================== CHESS HELPERS ====================
type ChessPiece = { color: 'w' | 'b'; type: 'p' | 'r' | 'n' | 'b' | 'q' | 'k'; moved?: boolean } | null;

const CHESS_GLYPHS: Record<string, string> = {
  wp: '♙',
  wr: '♖',
  wn: '♘',
  wb: '♗',
  wq: '♕',
  wk: '♔',
  bp: '♟',
  br: '♜',
  bn: '♞',
  bb: '♝',
  bq: '♛',
  bk: '♚',
};

function createInitialChessBoard(): ChessPiece[][] {
  const backRank: Array<'r' | 'n' | 'b' | 'q' | 'k' | 'b' | 'n' | 'r'> = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  const board: ChessPiece[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = { color: 'b', type: backRank[c] };
    board[1][c] = { color: 'b', type: 'p' };
    board[6][c] = { color: 'w', type: 'p' };
    board[7][c] = { color: 'w', type: backRank[c] };
  }
  return board;
}

function getLegalChessMoves(board: ChessPiece[][], r: number, c: number): Array<[number, number]> {
  const piece = board[r][c];
  if (!piece) return [];
  const moves: Array<[number, number]> = [];
  const inBounds = (nr: number, nc: number) => nr >= 0 && nr < 8 && nc >= 0 && nc < 8;

  if (piece.type === 'p') {
    const dir = piece.color === 'w' ? -1 : 1;
    const startRow = piece.color === 'w' ? 6 : 1;
    if (inBounds(r + dir, c) && !board[r + dir][c]) {
      moves.push([r + dir, c]);
      if (r === startRow && !board[r + dir * 2][c]) {
        moves.push([r + dir * 2, c]);
      }
    }
    for (const dc of [-1, 1]) {
      if (inBounds(r + dir, c + dc) && board[r + dir][c + dc] && board[r + dir][c + dc]?.color !== piece.color) {
        moves.push([r + dir, c + dc]);
      }
    }
  } else if (piece.type === 'n') {
    const jumps = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1],
    ];
    for (const [dr, dc] of jumps) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc) && board[nr][nc]?.color !== piece.color) {
        moves.push([nr, nc]);
      }
    }
  } else if (piece.type === 'k') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc) && board[nr][nc]?.color !== piece.color) {
          moves.push([nr, nc]);
        }
      }
    }
    if (!piece.moved && (r === 7 || r === 0) && c === 4) {
      if (!board[r][5] && !board[r][6] && board[r][7]?.type === 'r' && !board[r][7]?.moved) {
        moves.push([r, 6]);
      }
      if (!board[r][3] && !board[r][2] && !board[r][1] && board[r][0]?.type === 'r' && !board[r][0]?.moved) {
        moves.push([r, 2]);
      }
    }
  } else {
    const dirs: Array<[number, number]> = [];
    if (piece.type === 'r' || piece.type === 'q') {
      dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
    }
    if (piece.type === 'b' || piece.type === 'q') {
      dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    }
    for (const [dr, dc] of dirs) {
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc)) {
        if (!board[nr][nc]) {
          moves.push([nr, nc]);
        } else {
          if (board[nr][nc]?.color !== piece.color) moves.push([nr, nc]);
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }
  return moves;
}

// ==================== CHECKERS HELPERS ====================
type CheckerCell = { color: 'r' | 'b'; king: boolean } | null;
function createCheckersBoard(): CheckerCell[][] {
  const b: CheckerCell[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        if (r < 3) b[r][c] = { color: 'b', king: false };
        if (r > 4) b[r][c] = { color: 'r', king: false };
      }
    }
  }
  return b;
}

// ==================== REVERSI HELPERS ====================
type ReversiCell = 'B' | 'W' | null;
function createReversiBoard(): ReversiCell[][] {
  const b: ReversiCell[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  b[3][3] = 'W';
  b[3][4] = 'B';
  b[4][3] = 'B';
  b[4][4] = 'W';
  return b;
}

function getReversiFlips(board: ReversiCell[][], r: number, c: number, color: 'B' | 'W'): Array<[number, number]> {
  if (board[r][c] !== null) return [];
  const opp = color === 'B' ? 'W' : 'B';
  const flips: Array<[number, number]> = [];
  const dirs = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],          [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];
  for (const [dr, dc] of dirs) {
    const line: Array<[number, number]> = [];
    let nr = r + dr;
    let nc = c + dc;
    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === opp) {
      line.push([nr, nc]);
      nr += dr;
      nc += dc;
    }
    if (line.length > 0 && nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === color) {
      flips.push(...line);
    }
  }
  return flips;
}

// ==================== SHOGI (9x9 JAPANESE CHESS) HELPERS ====================
type ShogiPieceType = 'K' | 'R' | 'B' | 'G' | 'S' | 'N' | 'L' | 'P';
interface ShogiPiece {
  owner: 'sente' | 'gote';
  type: ShogiPieceType;
  promoted: boolean;
}
type ShogiCell = ShogiPiece | null;

const SHOGI_LABELS: Record<ShogiPieceType, { kanji: string; promotedKanji: string; eng: string }> = {
  K: { kanji: '王', promotedKanji: '王', eng: 'K' },
  R: { kanji: '飛', promotedKanji: '龍', eng: 'R' },
  B: { kanji: '角', promotedKanji: '馬', eng: 'B' },
  G: { kanji: '金', promotedKanji: '金', eng: 'G' },
  S: { kanji: '銀', promotedKanji: '全', eng: 'S' },
  N: { kanji: '桂', promotedKanji: '圭', eng: 'N' },
  L: { kanji: '香', promotedKanji: '杏', eng: 'L' },
  P: { kanji: '歩', promotedKanji: 'と', eng: 'P' },
};

function createInitialShogiBoard(): ShogiCell[][] {
  const b: ShogiCell[][] = Array.from({ length: 9 }, () => Array(9).fill(null));
  const backRow: ShogiPieceType[] = ['L', 'N', 'S', 'G', 'K', 'G', 'S', 'N', 'L'];
  for (let c = 0; c < 9; c++) {
    b[0][c] = { owner: 'gote', type: backRow[c], promoted: false };
    b[2][c] = { owner: 'gote', type: 'P', promoted: false };
    b[6][c] = { owner: 'sente', type: 'P', promoted: false };
    b[8][c] = { owner: 'sente', type: backRow[c], promoted: false };
  }
  b[1][1] = { owner: 'gote', type: 'R', promoted: false };
  b[1][7] = { owner: 'gote', type: 'B', promoted: false };
  b[7][1] = { owner: 'sente', type: 'B', promoted: false };
  b[7][7] = { owner: 'sente', type: 'R', promoted: false };
  return b;
}

function getLegalShogiMoves(board: ShogiCell[][], r: number, c: number): Array<[number, number]> {
  const p = board[r][c];
  if (!p) return [];
  const moves: Array<[number, number]> = [];
  const fwd = p.owner === 'sente' ? -1 : 1;
  const inBounds = (nr: number, nc: number) => nr >= 0 && nr < 9 && nc >= 0 && nc < 9;
  const addStep = (dr: number, dc: number) => {
    const nr = r + dr;
    const nc = c + dc;
    if (inBounds(nr, nc) && board[nr][nc]?.owner !== p.owner) {
      moves.push([nr, nc]);
    }
  };
  const addSlide = (dr: number, dc: number) => {
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc)) {
      if (!board[nr][nc]) {
        moves.push([nr, nc]);
      } else {
        if (board[nr][nc]?.owner !== p.owner) moves.push([nr, nc]);
        break;
      }
      nr += dr;
      nc += dc;
    }
  };

  const behavesAsGold = p.type === 'G' || (p.promoted && ['S', 'N', 'L', 'P'].includes(p.type));

  if (p.type === 'K') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr !== 0 || dc !== 0) addStep(dr, dc);
      }
    }
  } else if (behavesAsGold) {
    addStep(fwd, -1);
    addStep(fwd, 0);
    addStep(fwd, 1);
    addStep(0, -1);
    addStep(0, 1);
    addStep(-fwd, 0);
  } else if (p.type === 'S') {
    addStep(fwd, -1);
    addStep(fwd, 0);
    addStep(fwd, 1);
    addStep(-fwd, -1);
    addStep(-fwd, 1);
  } else if (p.type === 'N') {
    addStep(fwd * 2, -1);
    addStep(fwd * 2, 1);
  } else if (p.type === 'L') {
    addSlide(fwd, 0);
  } else if (p.type === 'P') {
    addStep(fwd, 0);
  } else if (p.type === 'R') {
    addSlide(-1, 0);
    addSlide(1, 0);
    addSlide(0, -1);
    addSlide(0, 1);
    if (p.promoted) {
      addStep(-1, -1);
      addStep(-1, 1);
      addStep(1, -1);
      addStep(1, 1);
    }
  } else if (p.type === 'B') {
    addSlide(-1, -1);
    addSlide(-1, 1);
    addSlide(1, -1);
    addSlide(1, 1);
    if (p.promoted) {
      addStep(-1, 0);
      addStep(1, 0);
      addStep(0, -1);
      addStep(0, 1);
    }
  }
  return moves;
}

// ==================== GO (9x9 / 13x13 / 19x19) HELPERS ====================
type GoStone = 'B' | 'W' | null;

function serializeGoBoard(board: GoStone[][]): string {
  return board.map((row) => row.map((c) => c || '.').join('')).join('/');
}

function getGoGroupAndLiberties(
  board: GoStone[][],
  startR: number,
  startC: number
): { group: Array<[number, number]>; liberties: number } {
  const size = board.length;
  const color = board[startR][startC];
  if (!color) return { group: [], liberties: 0 };

  const visited = new Set<string>();
  const libertySet = new Set<string>();
  const group: Array<[number, number]> = [];
  const queue: Array<[number, number]> = [[startR, startC]];
  visited.add(`${startR},${startC}`);

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    group.push([r, c]);
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const neighbor = board[nr][nc];
      if (neighbor === null) {
        libertySet.add(`${nr},${nc}`);
      } else if (neighbor === color && !visited.has(`${nr},${nc}`)) {
        visited.add(`${nr},${nc}`);
        queue.push([nr, nc]);
      }
    }
  }
  return { group, liberties: libertySet.size };
}

function applyGoMove(
  board: GoStone[][],
  r: number,
  c: number,
  color: 'B' | 'W',
  previousHash?: string
): { valid: boolean; nextBoard: GoStone[][]; capturedCount: number; reason?: string } {
  if (board[r][c] !== null) {
    return { valid: false, nextBoard: board, capturedCount: 0, reason: 'Intersection already occupied.' };
  }
  const size = board.length;
  const opp: 'B' | 'W' = color === 'B' ? 'W' : 'B';
  const next = board.map((row) => [...row]);
  next[r][c] = color;

  let capturedCount = 0;
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < size && nc >= 0 && nc < size && next[nr][nc] === opp) {
      const { group, liberties } = getGoGroupAndLiberties(next, nr, nc);
      if (liberties === 0) {
        for (const [gr, gc] of group) {
          next[gr][gc] = null;
          capturedCount++;
        }
      }
    }
  }

  // Suicide check
  const selfCheck = getGoGroupAndLiberties(next, r, c);
  if (selfCheck.liberties === 0) {
    return {
      valid: false,
      nextBoard: board,
      capturedCount: 0,
      reason: 'Illegal Suicide: Stone placement leaves your group with 0 Liberties.',
    };
  }

  // Simple Ko rule check
  if (previousHash && serializeGoBoard(next) === previousHash) {
    return {
      valid: false,
      nextBoard: board,
      capturedCount: 0,
      reason: 'Illegal Ko Recapture: Cannot immediately repeat the previous board state.',
    };
  }

  return { valid: true, nextBoard: next, capturedCount };
}

// ==================== SUDOKU (9x9 LOGIC GRID) HELPERS ====================
const SUDOKU_SOLUTION: number[][] = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

function createSudokuPuzzle(difficulty: 'easy' | 'medium' | 'hard'): {
  grid: number[][];
  fixed: boolean[][];
} {
  const hideModulo = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 2 : 1;
  const grid: number[][] = [];
  const fixed: boolean[][] = [];
  for (let r = 0; r < 9; r++) {
    const gRow: number[] = [];
    const fRow: boolean[] = [];
    for (let c = 0; c < 9; c++) {
      const keep =
        difficulty === 'easy'
          ? (r * 7 + c * 3) % 5 !== 0 && (r + c) % hideModulo !== 0
          : difficulty === 'medium'
          ? (r * 5 + c * 3) % 3 === 0
          : (r * 11 + c * 7) % 4 === 0;
      gRow.push(keep ? SUDOKU_SOLUTION[r][c] : 0);
      fRow.push(keep);
    }
    grid.push(gRow);
    fixed.push(fRow);
  }
  return { grid, fixed };
}

// ==================== CORRIDOR (QUORIDOR 9x9) HELPERS ====================
export interface CorridorWall {
  r: number;
  c: number;
  orientation: 'H' | 'V';
}

function isCorridorStepBlocked(
  walls: CorridorWall[],
  r1: number,
  c1: number,
  r2: number,
  c2: number
): boolean {
  if (r2 < 0 || r2 >= 9 || c2 < 0 || c2 >= 9) return true;
  if (r1 === r2 && Math.abs(c1 - c2) === 1) {
    const minC = Math.min(c1, c2);
    return walls.some(
      (w) => w.orientation === 'V' && w.c === minC && (w.r === r1 || w.r === r1 - 1)
    );
  }
  if (c1 === c2 && Math.abs(r1 - r2) === 1) {
    const minR = Math.min(r1, r2);
    return walls.some(
      (w) => w.orientation === 'H' && w.r === minR && (w.c === c1 || w.c === c1 - 1)
    );
  }
  return true;
}

function getCorridorShortestPath(
  walls: CorridorWall[],
  start: [number, number],
  goalRow: number
): Array<[number, number]> | null {
  const visited = new Set<string>([`${start[0]},${start[1]}`]);
  const queue: Array<{ pos: [number, number]; path: Array<[number, number]> }> = [
    { pos: start, path: [] },
  ];

  while (queue.length > 0) {
    const { pos, path } = queue.shift()!;
    const [r, c] = pos;
    if (r === goalRow) return path;

    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nr = r + dr;
      const nc = c + dc;
      const key = `${nr},${nc}`;
      if (
        nr >= 0 &&
        nr < 9 &&
        nc >= 0 &&
        nc < 9 &&
        !visited.has(key) &&
        !isCorridorStepBlocked(walls, r, c, nr, nc)
      ) {
        visited.add(key);
        queue.push({ pos: [nr, nc], path: [...path, [nr, nc]] });
      }
    }
  }
  return null;
}

function canPlaceCorridorWall(
  walls: CorridorWall[],
  candidate: CorridorWall,
  p1Pos: [number, number],
  p2Pos: [number, number]
): { valid: boolean; reason?: string } {
  const { r, c, orientation } = candidate;
  if (r < 0 || r > 7 || c < 0 || c > 7) {
    return { valid: false, reason: 'Fence out of bounds.' };
  }
  for (const w of walls) {
    if (w.r === r && w.c === c) {
      return { valid: false, reason: 'A fence already occupies or crosses this intersection.' };
    }
    if (
      orientation === 'H' &&
      w.orientation === 'H' &&
      w.r === r &&
      Math.abs(w.c - c) === 1
    ) {
      return { valid: false, reason: 'Horizontal fence overlaps an adjacent horizontal fence.' };
    }
    if (
      orientation === 'V' &&
      w.orientation === 'V' &&
      w.c === c &&
      Math.abs(w.r - r) === 1
    ) {
      return { valid: false, reason: 'Vertical fence overlaps an adjacent vertical fence.' };
    }
  }

  const nextWalls = [...walls, candidate];
  const p1Path = getCorridorShortestPath(nextWalls, p1Pos, 0);
  const p2Path = getCorridorShortestPath(nextWalls, p2Pos, 8);
  if (!p1Path || !p2Path) {
    return {
      valid: false,
      reason: 'Illegal Fence (Fair-Play BFS Rule: Every player must retain at least one open path to their goal baseline).',
    };
  }
  return { valid: true };
}

function getLegalCorridorPawnMoves(
  walls: CorridorWall[],
  myPos: [number, number],
  oppPos: [number, number]
): Array<[number, number]> {
  const [r, c] = myPos;
  const moves: Array<[number, number]> = [];
  const dirs: Array<[number, number]> = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= 9 || nc < 0 || nc >= 9) continue;
    if (isCorridorStepBlocked(walls, r, c, nr, nc)) continue;

    if (nr === oppPos[0] && nc === oppPos[1]) {
      const jr = nr + dr;
      const jc = nc + dc;
      if (
        jr >= 0 &&
        jr < 9 &&
        jc >= 0 &&
        jc < 9 &&
        !isCorridorStepBlocked(walls, nr, nc, jr, jc)
      ) {
        moves.push([jr, jc]);
      } else {
        const perpDirs: Array<[number, number]> =
          dr !== 0
            ? [
                [0, -1],
                [0, 1],
              ]
            : [
                [-1, 0],
                [1, 0],
              ];
        for (const [pdr, pdc] of perpDirs) {
          const djr = nr + pdr;
          const djc = nc + pdc;
          if (
            djr >= 0 &&
            djr < 9 &&
            djc >= 0 &&
            djc < 9 &&
            !isCorridorStepBlocked(walls, nr, nc, djr, djc)
          ) {
            moves.push([djr, djc]);
          }
        }
      }
    } else {
      moves.push([nr, nc]);
    }
  }
  return moves;
}

export const BoardGamesView: React.FC<BoardGamesViewProps> = ({
  points,
  dailyPointsEarned,
  isP2PConnected,
  activeP2PPointBet,
  onPlaceP2PPointBet,
  onCommitResult,
  onSyncP2PState,
}) => {
  const [mode, setMode] = useState<BoardGameMode>('corridor');

  const {
    winMenuPayload,
    broadcastMove,
    triggerGameComplete,
    dismissWinMenu,
    handlePlayAgain,
  } = useP2PGameSync({
    points,
    dailyPointsEarned,
    isP2PConnected,
    activeP2PPointBet,
    onCommitResult,
    onSyncP2PState,
  });

  // ==================== 1. CHESS STATE ====================
  const [chessBoard, setChessBoard] = useState<ChessPiece[][]>(createInitialChessBoard);
  const [chessSelected, setChessSelected] = useState<[number, number] | null>(null);
  const [chessTurn, setChessTurn] = useState<'w' | 'b'>('w');
  const [chessLog, setChessLog] = useState<string[]>([]);
  const [chessStatus, setChessStatus] = useState<string>('White to move · Click any gold piece to see legal moves');

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const legalTargets = chessSelected ? getLegalChessMoves(chessBoard, chessSelected[0], chessSelected[1]) : [];

  const resetChessGame = () => {
    setChessBoard(createInitialChessBoard());
    setChessSelected(null);
    setChessTurn('w');
    setChessLog([]);
    setChessStatus('New Chess match initialized · White to move');
    nativeBridge.playSfx('card');
  };

  const handleChessSquareClick = (r: number, c: number) => {
    if (chessTurn !== 'w') return;
    const clicked = chessBoard[r][c];

    if (chessSelected) {
      const isLegal = legalTargets.some(([tr, tc]) => tr === r && tc === c);
      if (isLegal) {
        const [sr, sc] = chessSelected;
        const moving = chessBoard[sr][sc]!;
        const target = chessBoard[r][c];
        const nextBoard = chessBoard.map((row) => [...row]);
        const promotedType = moving.type === 'p' && r === 0 ? 'q' : moving.type;
        nextBoard[r][c] = { color: 'w', type: promotedType, moved: true };
        nextBoard[sr][sc] = null;

        if (moving.type === 'k' && Math.abs(c - sc) === 2) {
          if (c === 6) {
            nextBoard[r][5] = { color: 'w', type: 'r', moved: true };
            nextBoard[r][7] = null;
          } else if (c === 2) {
            nextBoard[r][3] = { color: 'w', type: 'r', moved: true };
            nextBoard[r][0] = null;
          }
        }

        const moveNotation = `${moving.type.toUpperCase()}${files[sc]}${8 - sr}${target ? 'x' : '→'}${files[c]}${8 - r}`;
        const nextLog = [...chessLog, moveNotation];
        setChessBoard(nextBoard);
        setChessSelected(null);
        setChessLog(nextLog);
        nativeBridge.playSfx(target ? 'hit' : 'move');
        broadcastMove('chess', { lastMove: moveNotation, moveCount: nextLog.length });

        if (target?.type === 'k') {
          setChessStatus('Checkmate! You captured the Black King (+300 chips, +1 Daily Pt)');
          nativeBridge.playSfx('victory');
          triggerGameComplete({
            gameId: 'chess',
            gameTitle: 'Classical Chess (8×8)',
            gameTypeLedger: 'CHESS',
            outcome: 'win',
            headline: 'Checkmate Victory!',
            subheadline: `Decisive checkmate delivered on move ${nextLog.length} (${moveNotation}).`,
            chipsDelta: 300,
            stats: [
              { label: 'Winning Move', value: moveNotation },
              { label: 'Total Plies', value: `${nextLog.length} Moves` },
              { label: 'Rule Engine', value: 'FIDE Castling + Promo' },
            ],
            statePayload: { moves: nextLog.length },
            onPlayAgain: resetChessGame,
          });
          return;
        }

        setChessTurn('b');
        setChessStatus(`Played ${moveNotation} · Kaspar Node calculating reply...`);

        window.setTimeout(() => {
          const allBlackMoves: Array<{ from: [number, number]; to: [number, number]; score: number }> = [];
          const valMap: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
          for (let br = 0; br < 8; br++) {
            for (let bc = 0; bc < 8; bc++) {
              if (nextBoard[br][bc]?.color === 'b') {
                const bMoves = getLegalChessMoves(nextBoard, br, bc);
                for (const [mr, mc] of bMoves) {
                  const cap = nextBoard[mr][mc];
                  const centerBonus = mr >= 2 && mr <= 5 && mc >= 2 && mc <= 5 ? 0.4 : 0;
                  const score = (cap ? valMap[cap.type] * 10 : 0) + centerBonus + Math.random() * 0.3;
                  allBlackMoves.push({ from: [br, bc], to: [mr, mc], score });
                }
              }
            }
          }
          if (allBlackMoves.length > 0) {
            allBlackMoves.sort((a, b) => b.score - a.score);
            const chosen = allBlackMoves[0];
            const bPiece = nextBoard[chosen.from[0]][chosen.from[1]]!;
            const bCap = nextBoard[chosen.to[0]][chosen.to[1]];
            const afterBot = nextBoard.map((row) => [...row]);
            afterBot[chosen.to[0]][chosen.to[1]] = {
              color: 'b',
              type: bPiece.type === 'p' && chosen.to[0] === 7 ? 'q' : bPiece.type,
              moved: true,
            };
            afterBot[chosen.from[0]][chosen.from[1]] = null;
            const botNotation = `${bPiece.type.toUpperCase()}${files[chosen.from[1]]}${8 - chosen.from[0]}${bCap ? 'x' : '→'}${files[chosen.to[1]]}${8 - chosen.to[0]}`;
            setChessBoard(afterBot);
            setChessLog((prev) => [...prev, botNotation]);
            setChessTurn('w');
            setChessStatus(`Kaspar played ${botNotation} · White to move`);
            nativeBridge.playSfx('move');
          }
        }, 450);
        return;
      }
    }

    if (clicked && clicked.color === 'w') {
      setChessSelected([r, c]);
      nativeBridge.playSfx('move');
    } else {
      setChessSelected(null);
    }
  };

  // ==================== 2. CHECKERS STATE ====================
  const [checkersBoard, setCheckersBoard] = useState<CheckerCell[][]>(createCheckersBoard);
  const [checkerSelected, setCheckerSelected] = useState<[number, number] | null>(null);
  const [checkerBanner, setCheckerBanner] = useState<string>('Gold Draughts to move · Jumps capture opponent pieces');

  const resetCheckersGame = () => {
    setCheckersBoard(createCheckersBoard());
    setCheckerSelected(null);
    setCheckerBanner('Checkers board reset · Gold to move');
    nativeBridge.playSfx('card');
  };

  const handleCheckerClick = (r: number, c: number) => {
    const cell = checkersBoard[r][c];
    if (cell && cell.color === 'r') {
      setCheckerSelected([r, c]);
      nativeBridge.playSfx('move');
      return;
    }
    if (!cell && checkerSelected) {
      const [sr, sc] = checkerSelected;
      const piece = checkersBoard[sr][sc];
      if (!piece) return;
      const dr = r - sr;
      const dc = c - sc;
      const allowedDirs = piece.king ? [-1, 1] : [-1];

      const isStep = allowedDirs.includes(dr) && Math.abs(dc) === 1;
      const isJump = allowedDirs.map((d) => d * 2).includes(dr) && Math.abs(dc) === 2;
      const midR = sr + dr / 2;
      const midC = sc + dc / 2;

      if (isStep || (isJump && checkersBoard[midR]?.[midC]?.color === 'b')) {
        const next = checkersBoard.map((row) => [...row]);
        next[r][c] = { color: 'r', king: piece.king || r === 0 };
        next[sr][sc] = null;
        if (isJump) next[midR][midC] = null;
        setCheckersBoard(next);
        setCheckerSelected(null);
        nativeBridge.playSfx(isJump ? 'hit' : 'move');

        const remainingBlack = next.flat().filter((p) => p?.color === 'b').length;
        const remainingRed = next.flat().filter((p) => p?.color === 'r').length;
        if (remainingBlack === 0) {
          setCheckerBanner('Victory! All opponent draughts captured (+220 chips, +1 Daily Pt)');
          nativeBridge.playSfx('victory');
          triggerGameComplete({
            gameId: 'checkers',
            gameTitle: 'Checkers (8×8 Draughts)',
            gameTypeLedger: 'CHECKERS',
            outcome: 'win',
            headline: 'Checkers Sweep Victory!',
            subheadline: 'All 12 opponent draughts were eliminated from the dark-square diagonals.',
            chipsDelta: 220,
            stats: [
              { label: 'Your Pieces Left', value: `${remainingRed} Draughts` },
              { label: 'Opponent Pieces', value: '0 Remaining' },
              { label: 'Final Move', value: isJump ? 'Jump Capture' : 'Crown Advance' },
            ],
            onPlayAgain: resetCheckersGame,
          });
          return;
        }

        window.setTimeout(() => {
          const botNext = next.map((row) => [...row]);
          for (let br = 0; br < 8; br++) {
            for (let bc = 0; bc < 8; bc++) {
              const bp = botNext[br][bc];
              if (bp?.color === 'b') {
                for (const dCol of [-1, 1]) {
                  const jr = br + 2;
                  const jc = bc + dCol * 2;
                  if (jr < 8 && jc >= 0 && jc < 8 && !botNext[jr][jc] && botNext[br + 1]?.[bc + dCol]?.color === 'r') {
                    botNext[jr][jc] = { color: 'b', king: bp.king || jr === 7 };
                    botNext[br + 1][bc + dCol] = null;
                    botNext[br][bc] = null;
                    setCheckersBoard(botNext);
                    setCheckerBanner('Peer executed jump capture · Your turn');
                    return;
                  }
                  const tr = br + 1;
                  const tc = bc + dCol;
                  if (tr < 8 && tc >= 0 && tc < 8 && !botNext[tr][tc]) {
                    botNext[tr][tc] = { color: 'b', king: bp.king || tr === 7 };
                    botNext[br][bc] = null;
                    setCheckersBoard(botNext);
                    setCheckerBanner('Peer moved · Your turn');
                    return;
                  }
                }
              }
            }
          }
        }, 420);
      }
    }
  };

  // ==================== 3. REVERSI (OTHELLO) STATE ====================
  const [reversiBoard, setReversiBoard] = useState<ReversiCell[][]>(createReversiBoard);
  const [reversiBanner, setReversiBanner] = useState<string>('Gold Discs to place · Outflank Obsidian discs');

  const reversiScores = useMemo(() => {
    let b = 0;
    let w = 0;
    reversiBoard.forEach((row) =>
      row.forEach((cell) => {
        if (cell === 'B') b++;
        if (cell === 'W') w++;
      })
    );
    return { b, w };
  }, [reversiBoard]);

  const resetReversiGame = () => {
    setReversiBoard(createReversiBoard());
    setReversiBanner('Reversi 8×8 reset · Gold to place disc');
    nativeBridge.playSfx('card');
  };

  const finishReversiMatch = (boardState = reversiBoard) => {
    let b = 0;
    let w = 0;
    boardState.forEach((row) =>
      row.forEach((cell) => {
        if (cell === 'B') b++;
        if (cell === 'W') w++;
      })
    );
    const won = b >= w;
    nativeBridge.playSfx(won ? 'victory' : 'chip');
    triggerGameComplete({
      gameId: 'reversi',
      gameTitle: 'Reversi (Othello 8×8)',
      gameTypeLedger: 'REVERSI',
      outcome: won ? 'win' : 'loss',
      headline: won ? `Reversi Victory (${b} vs ${w})!` : `Opponent Wins Reversi (${w} vs ${b})`,
      subheadline: won
        ? `Your Gold discs controlled ${b} squares across the 8×8 grid against ${w} opponent discs.`
        : `Opponent held ${w} squares vs your ${b} discs.`,
      chipsDelta: won ? 240 : -80,
      stats: [
        { label: 'Your Gold Discs', value: `${b} Squares` },
        { label: 'Opponent Discs', value: `${w} Squares` },
        { label: 'Spread Margin', value: `${b - w >= 0 ? '+' : ''}${b - w} Discs` },
      ],
      onPlayAgain: resetReversiGame,
    });
  };

  const handleReversiClick = (r: number, c: number) => {
    const flips = getReversiFlips(reversiBoard, r, c, 'B');
    if (flips.length === 0) {
      nativeBridge.playSfx('error');
      return;
    }
    const next = reversiBoard.map((row) => [...row]);
    next[r][c] = 'B';
    for (const [fr, fc] of flips) {
      next[fr][fc] = 'B';
    }
    setReversiBoard(next);
    nativeBridge.playSfx('chip');
    setReversiBanner(`Flipped ${flips.length} discs · Opponent calculating...`);

    window.setTimeout(() => {
      const afterBot = next.map((row) => [...row]);
      let bestMove: { r: number; c: number; flips: Array<[number, number]> } | null = null;
      for (let br = 0; br < 8; br++) {
        for (let bc = 0; bc < 8; bc++) {
          const bFlips = getReversiFlips(afterBot, br, bc, 'W');
          if (bFlips.length > 0 && (!bestMove || bFlips.length > bestMove.flips.length)) {
            bestMove = { r: br, c: bc, flips: bFlips };
          }
        }
      }
      if (bestMove) {
        afterBot[bestMove.r][bestMove.c] = 'W';
        for (const [fr, fc] of bestMove.flips) {
          afterBot[fr][fc] = 'W';
        }
        setReversiBoard(afterBot);
        nativeBridge.playSfx('move');
        setReversiBanner(`Opponent placed at ${files[bestMove.c]}${bestMove.r + 1} · Your turn`);
      } else {
        setReversiBanner('Opponent had no legal flips · Your turn continues');
      }

      // Check if neither player has any legal moves left
      let anyPlayerMoves = false;
      for (let pr = 0; pr < 8; pr++) {
        for (let pc = 0; pc < 8; pc++) {
          if (getReversiFlips(afterBot, pr, pc, 'B').length > 0) {
            anyPlayerMoves = true;
            break;
          }
        }
      }
      if (!anyPlayerMoves && !bestMove) {
        finishReversiMatch(afterBot);
      }
    }, 420);
  };

  // ==================== 4. SHOGI (9x9 JAPANESE CHESS) STATE ====================
  const [shogiBoard, setShogiBoard] = useState<ShogiCell[][]>(createInitialShogiBoard);
  const [shogiSelected, setShogiSelected] = useState<[number, number] | null>(null);
  const [shogiCapturedHand, setShogiCapturedHand] = useState<ShogiPieceType[]>(['P']);
  const [selectedDropType, setSelectedDropType] = useState<ShogiPieceType | null>(null);
  const [shogiMovesCount, setShogiMovesCount] = useState<number>(0);
  const [shogiBanner, setShogiBanner] = useState<string>(
    'Sente (Bottom) to move · Select a piece on the 9×9 board or click a piece on your Komadai to Drop!'
  );

  const resetShogiGame = () => {
    setShogiBoard(createInitialShogiBoard());
    setShogiSelected(null);
    setShogiCapturedHand(['P']);
    setSelectedDropType(null);
    setShogiMovesCount(0);
    setShogiBanner('Shogi 9×9 board reset · Sente to move');
    nativeBridge.playSfx('card');
  };

  const shogiLegalTargets = shogiSelected
    ? getLegalShogiMoves(shogiBoard, shogiSelected[0], shogiSelected[1])
    : [];

  const handleShogiClick = (r: number, c: number) => {
    const cell = shogiBoard[r][c];

    if (selectedDropType && !cell) {
      if (selectedDropType === 'P') {
        const hasPawnInFile = shogiBoard.some(
          (row) => row[c]?.owner === 'sente' && row[c]?.type === 'P' && !row[c]?.promoted
        );
        if (hasPawnInFile || r === 0) {
          nativeBridge.playSfx('error');
          setShogiBanner('Illegal Drop (Nifu rule: you already have an unpromoted Pawn on this file).');
          return;
        }
      }

      const next = shogiBoard.map((row) => [...row]);
      next[r][c] = { owner: 'sente', type: selectedDropType, promoted: false };
      const idx = shogiCapturedHand.indexOf(selectedDropType);
      const nextHand = [...shogiCapturedHand];
      if (idx >= 0) nextHand.splice(idx, 1);

      setShogiBoard(next);
      setShogiCapturedHand(nextHand);
      setSelectedDropType(null);
      setShogiMovesCount((m) => m + 1);
      nativeBridge.playSfx('chip');
      setShogiBanner(`Dropped ${selectedDropType} (${SHOGI_LABELS[selectedDropType].kanji}) at ${9 - c}${r + 1}`);
      return;
    }

    if (shogiSelected) {
      const isLegal = shogiLegalTargets.some(([tr, tc]) => tr === r && tc === c);
      if (isLegal) {
        const [sr, sc] = shogiSelected;
        const moving = shogiBoard[sr][sc]!;
        const captured = shogiBoard[r][c];
        const next = shogiBoard.map((row) => [...row]);

        const canPromote = ['R', 'B', 'S', 'N', 'L', 'P'].includes(moving.type);
        const shouldPromote = moving.promoted || (canPromote && (r <= 2 || sr <= 2));

        next[r][c] = { owner: 'sente', type: moving.type, promoted: shouldPromote };
        next[sr][sc] = null;
        const nextMoveNum = shogiMovesCount + 1;
        setShogiMovesCount(nextMoveNum);

        if (captured) {
          if (captured.type === 'K') {
            setShogiBoard(next);
            setShogiSelected(null);
            setShogiBanner('Shogi Checkmate (Tsumi)! Captured Opponent King (+350 chips, +1 Daily Pt)');
            nativeBridge.playSfx('victory');
            triggerGameComplete({
              gameId: 'shogi',
              gameTitle: 'Shogi (9×9 Japanese Chess · 将棋)',
              gameTypeLedger: 'SHOGI',
              outcome: 'win',
              headline: 'Tsumi! Shogi Victory!',
              subheadline: `You captured the Gote King on move ${nextMoveNum} with ${shogiCapturedHand.length} reserve pieces on your Komadai.`,
              chipsDelta: 350,
              stats: [
                { label: 'Total Moves', value: `${nextMoveNum} Plies` },
                { label: 'Komadai Reserves', value: `${shogiCapturedHand.length} Pieces` },
                { label: 'Winning Piece', value: `${SHOGI_LABELS[moving.type].kanji} (${moving.type})` },
              ],
              onPlayAgain: resetShogiGame,
            });
            return;
          }
          setShogiCapturedHand((prev) => [...prev, captured.type]);
        }

        setShogiBoard(next);
        setShogiSelected(null);
        nativeBridge.playSfx(captured ? 'hit' : 'move');
        setShogiBanner(`Moved ${moving.type}${shouldPromote && !moving.promoted ? ' (Promoted!)' : ''} · Gote responding...`);

        window.setTimeout(() => {
          const afterBot = next.map((row) => [...row]);
          for (let br = 8; br >= 0; br--) {
            for (let bc = 0; bc < 9; bc++) {
              if (afterBot[br][bc]?.owner === 'gote') {
                const bMoves = getLegalShogiMoves(afterBot, br, bc);
                if (bMoves.length > 0) {
                  const [mr, mc] = bMoves[0];
                  const bp = afterBot[br][bc]!;
                  afterBot[mr][mc] = { owner: 'gote', type: bp.type, promoted: bp.promoted || mr >= 6 };
                  afterBot[br][bc] = null;
                  setShogiBoard(afterBot);
                  setShogiBanner(`Gote moved ${bp.type} to ${9 - mc}${mr + 1} · Sente (Your) turn`);
                  nativeBridge.playSfx('move');
                  return;
                }
              }
            }
          }
        }, 420);
        return;
      }
    }

    if (cell && cell.owner === 'sente') {
      setSelectedDropType(null);
      setShogiSelected([r, c]);
      nativeBridge.playSfx('move');
    } else {
      setShogiSelected(null);
    }
  };

  // ==================== 5. GO (9x9 / 13x13 / 19x19) STATE ====================
  const [goSize, setGoSize] = useState<9 | 13 | 19>(9);
  const [goBoard, setGoBoard] = useState<GoStone[][]>(() =>
    Array.from({ length: 9 }, () => Array(9).fill(null))
  );
  const [goPreviousHash, setGoPreviousHash] = useState<string>('');
  const [goBlackPrisoners, setGoBlackPrisoners] = useState<number>(0);
  const [goWhitePrisoners, setGoWhitePrisoners] = useState<number>(0);
  const [goBanner, setGoBanner] = useState<string>('Black to play · Place stone on any empty intersection');

  const resetGoBoard = (size: 9 | 13 | 19 = goSize) => {
    setGoSize(size);
    setGoBoard(Array.from({ length: size }, () => Array(size).fill(null)));
    setGoPreviousHash('');
    setGoBlackPrisoners(0);
    setGoWhitePrisoners(0);
    setGoBanner(`Initialized ${size}×${size} Go Goban · Black plays first`);
    nativeBridge.playSfx('card');
  };

  const handleGoIntersectionClick = (r: number, c: number) => {
    const preHash = serializeGoBoard(goBoard);
    const res = applyGoMove(goBoard, r, c, 'B', goPreviousHash);
    if (!res.valid) {
      nativeBridge.playSfx('error');
      setGoBanner(res.reason || 'Illegal placement.');
      return;
    }

    setGoPreviousHash(preHash);
    setGoBoard(res.nextBoard);
    if (res.capturedCount > 0) {
      setGoBlackPrisoners((p) => p + res.capturedCount);
      nativeBridge.playSfx('hit');
    } else {
      nativeBridge.playSfx('move');
    }
    setGoBanner(
      res.capturedCount > 0
        ? `Captured ${res.capturedCount} White stone(s)! · White responding...`
        : 'Stone placed · White responding...'
    );

    window.setTimeout(() => {
      const size = res.nextBoard.length;
      const candidates: Array<[number, number]> = [];
      for (let wr = 0; wr < size; wr++) {
        for (let wc = 0; wc < size; wc++) {
          if (res.nextBoard[wr][wc] === null) candidates.push([wr, wc]);
        }
      }
      candidates.sort((a, b) => {
        const mid = Math.floor(size / 2);
        const da = Math.abs(a[0] - mid) + Math.abs(a[1] - mid);
        const db = Math.abs(b[0] - mid) + Math.abs(b[1] - mid);
        return da - db + (Math.random() - 0.5) * 3;
      });
      for (const [wr, wc] of candidates) {
        const wRes = applyGoMove(res.nextBoard, wr, wc, 'W', preHash);
        if (wRes.valid) {
          setGoBoard(wRes.nextBoard);
          if (wRes.capturedCount > 0) {
            setGoWhitePrisoners((p) => p + wRes.capturedCount);
          }
          setGoBanner(`White placed stone at (${wr + 1}, ${wc + 1}) · Your turn`);
          nativeBridge.playSfx('move');
          return;
        }
      }
    }, 380);
  };

  const scoreAndFinishGoMatch = () => {
    let blackStones = 0;
    let whiteStones = 0;
    goBoard.forEach((row) =>
      row.forEach((s) => {
        if (s === 'B') blackStones++;
        if (s === 'W') whiteStones++;
      })
    );
    const blackTotal = blackStones + goBlackPrisoners;
    const whiteTotal = whiteStones + goWhitePrisoners + 6.5;
    const blackWon = blackTotal > whiteTotal;
    const margin = Math.abs(blackTotal - whiteTotal).toFixed(1);

    nativeBridge.playSfx(blackWon ? 'victory' : 'chip');
    setGoBanner(
      blackWon
        ? `Black Wins by ${margin} pts (${blackTotal} vs ${whiteTotal} w/ Komi) · +250 chips & +1 Daily Pt!`
        : `White Wins by ${margin} pts (${whiteTotal} w/ 6.5 Komi vs ${blackTotal})`
    );

    triggerGameComplete({
      gameId: 'go',
      gameTitle: `Go (${goSize}×${goSize} Goban · 囲碁)`,
      gameTypeLedger: 'GO',
      outcome: blackWon ? 'win' : 'loss',
      headline: blackWon ? `Black Wins by +${margin} Points!` : `White Wins by +${margin} Points`,
      subheadline: `Area & Prisoner Scoring complete on the ${goSize}×${goSize} Goban (Black ${blackTotal} pts vs White ${whiteTotal} pts including 6.5 Komi).`,
      chipsDelta: blackWon ? 250 : -50,
      stats: [
        { label: 'Black Score', value: `${blackTotal} Pts (${goBlackPrisoners} Prisoners)` },
        { label: 'White Score (+6.5 Komi)', value: `${whiteTotal} Pts` },
        { label: 'Board Size', value: `${goSize}×${goSize} Goban` },
      ],
      statePayload: { blackTotal, whiteTotal, goSize },
      onPlayAgain: () => resetGoBoard(goSize),
    });
  };

  // ==================== 6. SUDOKU (9x9 LOGIC GRID) STATE ====================
  const [sudokuDiff, setSudokuDiff] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [{ grid: sudokuGrid, fixed: sudokuFixed }, setSudokuState] = useState(() => createSudokuPuzzle('easy'));
  const [sudokuSelected, setSudokuSelected] = useState<[number, number]>([0, 2]);
  const [sudokuNotesMode, setSudokuNotesMode] = useState<boolean>(false);
  const [sudokuNotes, setSudokuNotes] = useState<Record<string, number[]>>({});
  const [sudokuHintsUsed, setSudokuHintsUsed] = useState<number>(0);
  const [sudokuBanner, setSudokuBanner] = useState<string>(
    'Select any cell and click a digit (1–9) below, or toggle Pencil Notes.'
  );

  const changeSudokuDifficulty = (diff: 'easy' | 'medium' | 'hard' = sudokuDiff) => {
    setSudokuDiff(diff);
    setSudokuState(createSudokuPuzzle(diff));
    setSudokuNotes({});
    setSudokuHintsUsed(0);
    setSudokuBanner(`Loaded ${diff.toUpperCase()} 9×9 Sudoku grid.`);
    nativeBridge.playSfx('card');
  };

  const hasSudokuConflict = (r: number, c: number, val: number): boolean => {
    if (val === 0) return false;
    for (let i = 0; i < 9; i++) {
      if (i !== c && sudokuGrid[r][i] === val) return true;
      if (i !== r && sudokuGrid[i][c] === val) return true;
    }
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        const nr = br + dr;
        const nc = bc + dc;
        if ((nr !== r || nc !== c) && sudokuGrid[nr][nc] === val) return true;
      }
    }
    return false;
  };

  const triggerSudokuSolvedModal = (hintsCount: number) => {
    setSudokuBanner('Sudoku Solved! All 81 cells verified (+200 chips & +1 Daily Win Point)');
    nativeBridge.playSfx('victory');
    triggerGameComplete({
      gameId: 'sudoku',
      gameTitle: `Sudoku 9×9 (${sudokuDiff.toUpperCase()})`,
      gameTypeLedger: 'SUDOKU',
      outcome: 'win',
      headline: '9×9 Logic Grid Solved!',
      subheadline: `All 81 cells, 9 rows, 9 columns, and 9 subgrid boxes verified with zero conflicts.`,
      chipsDelta: 200,
      stats: [
        { label: 'Difficulty', value: sudokuDiff.toUpperCase() },
        { label: 'Cells Verified', value: '81 / 81' },
        { label: 'Hints Used', value: `${hintsCount}` },
      ],
      statePayload: { difficulty: sudokuDiff, hintsUsed: hintsCount },
      onPlayAgain: () => changeSudokuDifficulty(sudokuDiff),
    });
  };

  const enterSudokuDigit = (digit: number) => {
    const [r, c] = sudokuSelected;
    if (sudokuFixed[r][c]) {
      nativeBridge.playSfx('error');
      setSudokuBanner('Clue cells are locked. Select an editable cell.');
      return;
    }

    if (sudokuNotesMode && digit > 0) {
      const key = `${r},${c}`;
      const existing = sudokuNotes[key] || [];
      const nextNotes = existing.includes(digit)
        ? existing.filter((n) => n !== digit)
        : [...existing, digit].sort();
      setSudokuNotes({ ...sudokuNotes, [key]: nextNotes });
      nativeBridge.playSfx('move');
      return;
    }

    const nextGrid = sudokuGrid.map((row) => [...row]);
    nextGrid[r][c] = digit;
    setSudokuState({ grid: nextGrid, fixed: sudokuFixed });
    nativeBridge.playSfx('chip');

    const isComplete = nextGrid.every((row, ri) =>
      row.every((val, ci) => val === SUDOKU_SOLUTION[ri][ci])
    );
    if (isComplete) {
      triggerSudokuSolvedModal(sudokuHintsUsed);
    }
  };

  const revealSudokuHint = () => {
    const [r, c] = sudokuSelected;
    if (!sudokuFixed[r][c]) {
      const correct = SUDOKU_SOLUTION[r][c];
      const nextHints = sudokuHintsUsed + 1;
      setSudokuHintsUsed(nextHints);
      const nextGrid = sudokuGrid.map((row) => [...row]);
      nextGrid[r][c] = correct;
      setSudokuState({ grid: nextGrid, fixed: sudokuFixed });
      nativeBridge.playSfx('chip');
      setSudokuBanner(`Hint revealed: Row ${r + 1}, Col ${c + 1} is ${correct}`);
      const isComplete = nextGrid.every((row, ri) =>
        row.every((val, ci) => val === SUDOKU_SOLUTION[ri][ci])
      );
      if (isComplete) {
        triggerSudokuSolvedModal(nextHints);
      }
    } else {
      // Find first empty cell if current cell is fixed
      for (let rr = 0; rr < 9; rr++) {
        for (let cc = 0; cc < 9; cc++) {
          if (sudokuGrid[rr][cc] !== SUDOKU_SOLUTION[rr][cc]) {
            const correct = SUDOKU_SOLUTION[rr][cc];
            const nextHints = sudokuHintsUsed + 1;
            setSudokuHintsUsed(nextHints);
            setSudokuSelected([rr, cc]);
            const nextGrid = sudokuGrid.map((row) => [...row]);
            nextGrid[rr][cc] = correct;
            setSudokuState({ grid: nextGrid, fixed: sudokuFixed });
            nativeBridge.playSfx('chip');
            setSudokuBanner(`Hint revealed: Row ${rr + 1}, Col ${cc + 1} is ${correct}`);
            const isComplete = nextGrid.every((row, ri) =>
              row.every((val, ci) => val === SUDOKU_SOLUTION[ri][ci])
            );
            if (isComplete) {
              triggerSudokuSolvedModal(nextHints);
            }
            return;
          }
        }
      }
    }
  };

  // ==================== 7. CORRIDOR (QUORIDOR 9x9) STATE ====================
  const [corridorP1, setCorridorP1] = useState<[number, number]>([8, 4]);
  const [corridorP2, setCorridorP2] = useState<[number, number]>([0, 4]);
  const [corridorWalls, setCorridorWalls] = useState<CorridorWall[]>([]);
  const [corridorP1WallsLeft, setCorridorP1WallsLeft] = useState<number>(10);
  const [corridorP2WallsLeft, setCorridorP2WallsLeft] = useState<number>(10);
  const [corridorFenceOrientation, setCorridorFenceOrientation] = useState<'H' | 'V'>('H');
  const [corridorTurn, setCorridorTurn] = useState<'p1' | 'p2'>('p1');
  const [corridorLog, setCorridorLog] = useState<string[]>([]);
  const [corridorBanner, setCorridorBanner] = useState<string>(
    'Your Turn (Gold Pawn) · Click a highlighted square to advance toward Row 1, or click a groove node (+) to place a 2-unit fence!'
  );

  const corridorLegalMoves = useMemo(
    () => (corridorTurn === 'p1' ? getLegalCorridorPawnMoves(corridorWalls, corridorP1, corridorP2) : []),
    [corridorWalls, corridorP1, corridorP2, corridorTurn]
  );

  const corridorPaths = useMemo(() => {
    const p1Path = getCorridorShortestPath(corridorWalls, corridorP1, 0);
    const p2Path = getCorridorShortestPath(corridorWalls, corridorP2, 8);
    return {
      p1Dist: p1Path ? p1Path.length : 99,
      p2Dist: p2Path ? p2Path.length : 99,
    };
  }, [corridorWalls, corridorP1, corridorP2]);

  const resetCorridorGame = () => {
    setCorridorP1([8, 4]);
    setCorridorP2([0, 4]);
    setCorridorWalls([]);
    setCorridorP1WallsLeft(10);
    setCorridorP2WallsLeft(10);
    setCorridorTurn('p1');
    setCorridorLog([]);
    setCorridorBanner(
      'Corridor 9×9 Reset · Reach Top Row 1 first! Click a square to move or a groove node (+) to place a fence.'
    );
    nativeBridge.playSfx('card');
  };

  const triggerCorridorBotReply = (
    nextWalls: CorridorWall[],
    p1Pos: [number, number],
    p2Pos: [number, number],
    p2WallsRem: number
  ) => {
    window.setTimeout(() => {
      const p1Path = getCorridorShortestPath(nextWalls, p1Pos, 0);
      const p2Path = getCorridorShortestPath(nextWalls, p2Pos, 8);

      if (
        p2WallsRem > 0 &&
        p1Path &&
        p2Path &&
        p1Path.length <= p2Path.length &&
        Math.random() < 0.55
      ) {
        const targetR = p1Pos[0] - 1;
        const candidateCols = [p1Pos[1], p1Pos[1] - 1, p1Pos[1] + 1].filter(
          (c) => c >= 0 && c <= 7
        );
        for (const candC of candidateCols) {
          const candWall: CorridorWall = { r: targetR, c: candC, orientation: 'H' };
          const check = canPlaceCorridorWall(nextWalls, candWall, p1Pos, p2Pos);
          if (check.valid) {
            const updatedWalls = [...nextWalls, candWall];
            setCorridorWalls(updatedWalls);
            setCorridorP2WallsLeft((w) => w - 1);
            setCorridorTurn('p1');
            const msg = `Peer placed Horizontal Fence at (${targetR + 1}, ${candC + 1})`;
            setCorridorLog((prev) => [...prev, msg]);
            setCorridorBanner(`${msg} · Your turn!`);
            nativeBridge.playSfx('hit');
            return;
          }
        }
      }

      const legalBotMoves = getLegalCorridorPawnMoves(nextWalls, p2Pos, p1Pos);
      if (legalBotMoves.length > 0) {
        let bestMove = legalBotMoves[0];
        let bestDist = 999;
        for (const [mr, mc] of legalBotMoves) {
          if (mr === 8) {
            bestMove = [mr, mc];
            bestDist = 0;
            break;
          }
          const pathFromMove = getCorridorShortestPath(nextWalls, [mr, mc], 8);
          const dist = pathFromMove ? pathFromMove.length : 999;
          if (dist < bestDist) {
            bestDist = dist;
            bestMove = [mr, mc];
          }
        }

        setCorridorP2(bestMove);
        const moveText = `Peer moved Pawn to R${bestMove[0] + 1}C${bestMove[1] + 1}`;
        setCorridorLog((prev) => [...prev, moveText]);
        nativeBridge.playSfx('move');

        if (bestMove[0] === 8) {
          setCorridorBanner('Peer Pawn reached Bottom Row 9!');
          triggerGameComplete({
            gameId: 'corridor',
            gameTitle: 'Corridor (Quoridor 9×9)',
            gameTypeLedger: 'CORRIDOR',
            outcome: 'loss',
            headline: 'Opponent Reached Baseline Row 9',
            subheadline: 'Your opponent navigated the fence maze to reach your baseline first.',
            chipsDelta: -100,
            stats: [
              { label: 'Your Fences Left', value: `${corridorP1WallsLeft} / 10` },
              { label: 'Total Fences on Board', value: `${nextWalls.length}` },
              { label: 'Your Remaining Steps', value: `${p1Path ? p1Path.length : 0} Steps` },
            ],
            statePayload: { wallsPlaced: nextWalls.length },
            onPlayAgain: resetCorridorGame,
          });
          return;
        }

        setCorridorTurn('p1');
        setCorridorBanner(`${moveText} · Your turn!`);
      } else {
        setCorridorTurn('p1');
      }
    }, 420);
  };

  const handleCorridorPawnMove = (r: number, c: number) => {
    if (corridorTurn !== 'p1') return;
    const isLegal = corridorLegalMoves.some(([mr, mc]) => mr === r && mc === c);
    if (!isLegal) {
      nativeBridge.playSfx('error');
      setCorridorBanner('Select a highlighted gold square adjacent to your pawn (or jump over an adjacent pawn).');
      return;
    }

    const nextP1: [number, number] = [r, c];
    setCorridorP1(nextP1);
    const notation = `You moved Pawn to R${r + 1}C${c + 1}`;
    const nextLog = [...corridorLog, notation];
    setCorridorLog(nextLog);
    nativeBridge.playSfx('move');
    broadcastMove('corridor', { p1: nextP1, p2: corridorP2, walls: corridorWalls });

    if (r === 0) {
      setCorridorBanner(
        'Corridor Victory! You reached the Top Baseline Row 1 (+320 chips & +1 Daily Win Point)!'
      );
      nativeBridge.playSfx('victory');
      triggerGameComplete({
        gameId: 'corridor',
        gameTitle: 'Corridor (Quoridor 9×9)',
        gameTypeLedger: 'CORRIDOR',
        outcome: 'win',
        headline: 'Corridor Baseline Breakthrough!',
        subheadline: `You navigated the 9×9 maze and reached Row 1 first with ${corridorP1WallsLeft} fences still in reserve!`,
        chipsDelta: 320,
        stats: [
          { label: 'Fences Remaining', value: `${corridorP1WallsLeft} / 10` },
          { label: 'Total Fences Placed', value: `${corridorWalls.length}` },
          { label: 'Moves Logged', value: `${nextLog.length} Turns` },
        ],
        statePayload: { fencesRemaining: corridorP1WallsLeft, totalWalls: corridorWalls.length },
        onPlayAgain: resetCorridorGame,
      });
      return;
    }

    setCorridorTurn('p2');
    setCorridorBanner(`${notation} · Peer calculating shortest path...`);
    triggerCorridorBotReply(corridorWalls, nextP1, corridorP2, corridorP2WallsLeft);
  };

  const handleCorridorPlaceWall = (wr: number, wc: number) => {
    if (corridorTurn !== 'p1') return;
    if (corridorP1WallsLeft <= 0) {
      nativeBridge.playSfx('error');
      setCorridorBanner('You have 0 fences remaining! Move your pawn to reach Row 1.');
      return;
    }

    const candidate: CorridorWall = {
      r: wr,
      c: wc,
      orientation: corridorFenceOrientation,
    };
    const check = canPlaceCorridorWall(corridorWalls, candidate, corridorP1, corridorP2);
    if (!check.valid) {
      nativeBridge.playSfx('error');
      setCorridorBanner(check.reason || 'Illegal fence placement.');
      return;
    }

    const nextWalls = [...corridorWalls, candidate];
    setCorridorWalls(nextWalls);
    setCorridorP1WallsLeft((w) => w - 1);
    const notation = `You placed ${corridorFenceOrientation === 'H' ? 'Horizontal' : 'Vertical'} Fence at (${wr + 1}, ${wc + 1})`;
    setCorridorLog((prev) => [...prev, notation]);
    nativeBridge.playSfx('chip');
    broadcastMove('corridor', { p1: corridorP1, p2: corridorP2, walls: nextWalls });

    setCorridorTurn('p2');
    setCorridorBanner(`${notation} · Peer recalculating maze path...`);
    triggerCorridorBotReply(nextWalls, corridorP1, corridorP2, corridorP2WallsLeft);
  };

  const resetActiveBoardGame = () => {
    if (mode === 'chess') resetChessGame();
    else if (mode === 'checkers') resetCheckersGame();
    else if (mode === 'reversi') resetReversiGame();
    else if (mode === 'corridor') resetCorridorGame();
    else if (mode === 'shogi') resetShogiGame();
    else if (mode === 'go') resetGoBoard(goSize);
    else changeSudokuDifficulty(sudokuDiff);
  };

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-6 space-y-5">
      {/* Header & 7-Game Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-yellow-500/25">
        <div>
          <h1 className="text-2xl font-bold text-yellow-400 font-display">
            02. Classical, Asian &amp; Abstract Strategy Board Arena
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-neutral-200 mt-1 font-mono tabular-nums">
            <span className="text-yellow-300 font-bold">
              Points: {points} ({dailyPointsEarned}/50 Today)
            </span>
            <span aria-hidden="true">·</span>
            <span>Interactive Tutorials, Visual Piece Diagrams &amp; Per-Game Victory Menus</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#100F0A] border border-yellow-500/35 rounded-xl">
          {BOARD_GAME_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                nativeBridge.playSfx('move');
                setMode(tab.id);
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === tab.id
                  ? 'bg-yellow-400 text-black shadow-sm'
                  : 'text-neutral-200 hover:text-yellow-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reusable Minimizable P2P Point Wager Escrow Bar */}
      <MinimizableEscrowBar
        points={points}
        dailyPointsEarned={dailyPointsEarned}
        isP2PConnected={isP2PConnected}
        activeP2PPointBet={activeP2PPointBet}
        onPlaceP2PPointBet={onPlaceP2PPointBet}
        arenaLabel="Board Arena P2P Point Wager Escrow"
      />

      {/* Reusable Minimizable Step-by-Step Interactive Tutorial with Visual Piece Diagrams */}
      <MinimizableTutorial gameId={mode} defaultMinimized={false} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left/Center 8 Cols: Interactive Game Board */}
        <div className="lg:col-span-8 flex flex-col items-center bg-[#0B0A07] border border-yellow-500/35 rounded-2xl p-6 space-y-4 shadow-2xl">
          {/* Top Board Status Bar */}
          <div className="w-full flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-yellow-500/20 text-xs sm:text-sm text-yellow-50">
            <span className="font-semibold">
              {mode === 'chess'
                ? chessStatus
                : mode === 'checkers'
                ? checkerBanner
                : mode === 'reversi'
                ? reversiBanner
                : mode === 'corridor'
                ? corridorBanner
                : mode === 'shogi'
                ? shogiBanner
                : mode === 'go'
                ? goBanner
                : sudokuBanner}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {mode === 'corridor' && (
                <div className="flex items-center gap-1 bg-[#14130C] p-1 rounded-xl border border-yellow-500/30">
                  <button
                    type="button"
                    onClick={() => setCorridorFenceOrientation('H')}
                    className={`px-3 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer ${
                      corridorFenceOrientation === 'H'
                        ? 'bg-yellow-400 text-black'
                        : 'text-neutral-300 hover:text-yellow-300'
                    }`}
                  >
                    ━ Horiz Fence
                  </button>
                  <button
                    type="button"
                    onClick={() => setCorridorFenceOrientation('V')}
                    className={`px-3 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer ${
                      corridorFenceOrientation === 'V'
                        ? 'bg-yellow-400 text-black'
                        : 'text-neutral-300 hover:text-yellow-300'
                    }`}
                  >
                    ┃ Vert Fence
                  </button>
                </div>
              )}

              {mode === 'go' && (
                <div className="flex items-center gap-1 bg-[#14130C] p-1 rounded-xl border border-yellow-500/30">
                  {([9, 13, 19] as const).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => resetGoBoard(sz)}
                      className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer ${
                        goSize === sz ? 'bg-yellow-400 text-black' : 'text-neutral-300 hover:text-yellow-300'
                      }`}
                    >
                      {sz}×{sz}
                    </button>
                  ))}
                </div>
              )}

              {mode === 'sudoku' && (
                <div className="flex items-center gap-1 bg-[#14130C] p-1 rounded-xl border border-yellow-500/30">
                  {(['easy', 'medium', 'hard'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => changeSudokuDifficulty(d)}
                      className={`px-2.5 py-1 text-xs font-mono uppercase font-bold rounded-lg cursor-pointer ${
                        sudokuDiff === d ? 'bg-yellow-400 text-black' : 'text-neutral-300 hover:text-yellow-300'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={resetActiveBoardGame}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#16150E] hover:bg-yellow-400 hover:text-black text-yellow-200 border border-yellow-500/35 rounded-xl text-xs font-mono font-bold cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Game</span>
              </button>
            </div>
          </div>

          {/* 1, 2, 3: CHESS, CHECKERS & REVERSI 8x8 BOARD */}
          {(mode === 'chess' || mode === 'checkers' || mode === 'reversi') && (
            <div className="space-y-3 flex flex-col items-center">
              <div className="grid grid-cols-8 border-2 border-yellow-500/45 rounded-xl overflow-hidden shadow-2xl">
                {Array.from({ length: 8 }).map((_, r) =>
                  Array.from({ length: 8 }).map((__, c) => {
                    const isDark = (r + c) % 2 === 1;

                    if (mode === 'chess') {
                      const piece = chessBoard[r][c];
                      const isSel = chessSelected?.[0] === r && chessSelected?.[1] === c;
                      const isTarget = legalTargets.some(([tr, tc]) => tr === r && tc === c);
                      return (
                        <button
                          key={`${r}-${c}`}
                          type="button"
                          onClick={() => handleChessSquareClick(r, c)}
                          className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-3xl relative transition-colors cursor-pointer ${
                            isSel
                              ? 'bg-yellow-500/45'
                              : isDark
                              ? 'bg-[#0E0E0E] hover:bg-[#191812]'
                              : 'bg-[#2B2616] hover:bg-[#38311C]'
                          }`}
                        >
                          {c === 0 && (
                            <span className="absolute top-0.5 left-1 text-[10px] font-mono opacity-75 text-yellow-400">
                              {8 - r}
                            </span>
                          )}
                          {r === 7 && (
                            <span className="absolute bottom-0.5 right-1 text-[10px] font-mono opacity-75 text-yellow-400">
                              {files[c]}
                            </span>
                          )}
                          {piece && (
                            <span
                              className={
                                piece.color === 'w'
                                  ? 'text-yellow-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]'
                                  : 'text-amber-500 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]'
                              }
                            >
                              {CHESS_GLYPHS[`${piece.color}${piece.type}`]}
                            </span>
                          )}
                          {isTarget && (
                            <span className="w-3.5 h-3.5 rounded-full bg-yellow-400 ring-2 ring-black pointer-events-none" />
                          )}
                        </button>
                      );
                    }

                    if (mode === 'checkers') {
                      const cell = checkersBoard[r][c];
                      const isSel = checkerSelected?.[0] === r && checkerSelected?.[1] === c;
                      return (
                        <button
                          key={`${r}-${c}`}
                          type="button"
                          onClick={() => handleCheckerClick(r, c)}
                          className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center cursor-pointer ${
                            isSel ? 'bg-yellow-500/40' : isDark ? 'bg-[#0E0E0E]' : 'bg-[#2B2616]'
                          }`}
                        >
                          {cell && (
                            <div
                              className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold shadow-md ${
                                cell.color === 'r'
                                  ? 'bg-yellow-400 border-yellow-200 text-black'
                                  : 'bg-[#050505] border-yellow-600/70 text-yellow-400'
                              }`}
                            >
                              {cell.king ? '♔' : ''}
                            </div>
                          )}
                        </button>
                      );
                    }

                    const disc = reversiBoard[r][c];
                    const flipCount = getReversiFlips(reversiBoard, r, c, 'B').length;
                    return (
                      <button
                        key={`${r}-${c}`}
                        type="button"
                        onClick={() => handleReversiClick(r, c)}
                        className="w-12 h-12 sm:w-14 sm:h-14 bg-[#11100A] hover:bg-[#1C1A10] border border-yellow-500/25 flex items-center justify-center cursor-pointer"
                      >
                        {disc ? (
                          <div
                            className={`w-9 h-9 rounded-full shadow-md ${
                              disc === 'B'
                                ? 'bg-yellow-400 border-2 border-yellow-200'
                                : 'bg-[#060606] border-2 border-yellow-500/70'
                            }`}
                          />
                        ) : flipCount > 0 ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-yellow-400/20 border border-yellow-400/50 text-xs font-mono font-bold text-yellow-300">
                            +{flipCount}
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>

              {mode === 'reversi' && (
                <button
                  type="button"
                  onClick={() => finishReversiMatch(reversiBoard)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold bg-yellow-400 hover:bg-yellow-300 text-black rounded-xl cursor-pointer"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Score Discs &amp; Open Reversi Win Menu ({reversiScores.b} vs {reversiScores.w})</span>
                </button>
              )}
            </div>
          )}

          {/* 3B. CORRIDOR (QUORIDOR 9x9 MAZE & 10 FENCES) */}
          {mode === 'corridor' && (
            <div className="space-y-4 flex flex-col items-center w-full">
              <div className="w-full max-w-[468px] flex items-center justify-between px-4 py-2.5 bg-[#12110B] border border-yellow-500/30 rounded-xl text-xs sm:text-sm font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
                  <span className="text-yellow-100">
                    You: <strong className="text-yellow-400">{corridorP1WallsLeft}/10 Fences</strong>
                  </span>
                </div>
                <span className="text-yellow-300 font-bold">
                  {corridorFenceOrientation === 'H' ? '━ Horiz' : '┃ Vert'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-600 inline-block" />
                  <span className="text-yellow-100">
                    Peer: <strong className="text-amber-400">{corridorP2WallsLeft}/10 Fences</strong>
                  </span>
                </div>
              </div>

              <div className="relative bg-[#080806] p-4 rounded-2xl border-2 border-yellow-500/45 shadow-2xl">
                <div className="text-xs font-mono text-yellow-400 text-center mb-2 tracking-wider uppercase font-bold">
                  ▲ Your Goal Baseline (Row 1) ▲
                </div>

                <div className="relative" style={{ width: 424, height: 424 }}>
                  {Array.from({ length: 9 }).map((_, r) =>
                    Array.from({ length: 9 }).map((__, c) => {
                      const isP1 = corridorP1[0] === r && corridorP1[1] === c;
                      const isP2 = corridorP2[0] === r && corridorP2[1] === c;
                      const isLegalMove = corridorLegalMoves.some(
                        ([mr, mc]) => mr === r && mc === c
                      );
                      const topPx = r * 48;
                      const leftPx = c * 48;

                      return (
                        <button
                          key={`cell-${r}-${c}`}
                          type="button"
                          onClick={() => handleCorridorPawnMove(r, c)}
                          style={{ top: topPx, left: leftPx, width: 40, height: 40 }}
                          className={`absolute rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                            isLegalMove
                              ? 'bg-yellow-400/30 border-yellow-300 hover:bg-yellow-400/45'
                              : r === 0
                              ? 'bg-yellow-950/35 border-yellow-500/60'
                              : r === 8
                              ? 'bg-amber-950/35 border-amber-700/60'
                              : 'bg-[#14130D] border-yellow-500/20 hover:border-yellow-400/60'
                          }`}
                        >
                          {isP1 && (
                            <div className="w-7 h-7 rounded-full bg-yellow-400 border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-black">
                              YOU
                            </div>
                          )}
                          {isP2 && (
                            <div className="w-7 h-7 rounded-full bg-[#080808] border-2 border-yellow-500 shadow-lg flex items-center justify-center text-[10px] font-bold text-yellow-400">
                              P2
                            </div>
                          )}
                          {!isP1 && !isP2 && isLegalMove && (
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-300 pointer-events-none" />
                          )}
                        </button>
                      );
                    })
                  )}

                  {corridorWalls.map((w, idx) => {
                    if (w.orientation === 'H') {
                      return (
                        <div
                          key={`wall-${idx}`}
                          style={{
                            top: w.r * 48 + 41,
                            left: w.c * 48,
                            width: 88,
                            height: 6,
                          }}
                          className="absolute rounded-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.75)] pointer-events-none z-20"
                        />
                      );
                    }
                    return (
                      <div
                        key={`wall-${idx}`}
                        style={{
                          top: w.r * 48,
                          left: w.c * 48 + 41,
                          width: 6,
                          height: 88,
                        }}
                        className="absolute rounded-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.75)] pointer-events-none z-20"
                      />
                    );
                  })}

                  {Array.from({ length: 8 }).map((_, wr) =>
                    Array.from({ length: 8 }).map((__, wc) => {
                      const occupied = corridorWalls.some((w) => w.r === wr && w.c === wc);
                      return (
                        <button
                          key={`groove-${wr}-${wc}`}
                          type="button"
                          title={`Place ${corridorFenceOrientation === 'H' ? 'Horizontal' : 'Vertical'} Fence at (${wr + 1}, ${wc + 1})`}
                          onClick={() => handleCorridorPlaceWall(wr, wc)}
                          style={{
                            top: wr * 48 + 38,
                            left: wc * 48 + 38,
                            width: 12,
                            height: 12,
                          }}
                          className={`absolute z-30 rounded-full flex items-center justify-center text-[9px] font-mono transition-transform cursor-pointer ${
                            occupied
                              ? 'bg-yellow-400 text-black pointer-events-none'
                              : 'bg-[#1C1A10] hover:bg-yellow-400 text-yellow-300 hover:text-black hover:scale-125 border border-yellow-500/40'
                          }`}
                        >
                          +
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="text-xs font-mono text-amber-400 text-center mt-2 tracking-wider uppercase font-bold">
                  ▼ Peer Goal Baseline (Row 9) ▼
                </div>
              </div>
            </div>
          )}

          {/* 4. SHOGI (9x9 JAPANESE CHESS) BOARD + KOMADAI */}
          {mode === 'shogi' && (
            <div className="space-y-4 w-full flex flex-col items-center">
              <div className="grid grid-cols-9 border-2 border-yellow-500/60 bg-[#D9A76A] rounded-xl overflow-hidden shadow-2xl">
                {Array.from({ length: 9 }).map((_, r) =>
                  Array.from({ length: 9 }).map((__, c) => {
                    const p = shogiBoard[r][c];
                    const isSel = shogiSelected?.[0] === r && shogiSelected?.[1] === c;
                    const isTarget = shogiLegalTargets.some(([tr, tc]) => tr === r && tc === c);
                    const lbl = p ? SHOGI_LABELS[p.type] : null;

                    return (
                      <button
                        key={`${r}-${c}`}
                        type="button"
                        onClick={() => handleShogiClick(r, c)}
                        className={`w-10 h-11 sm:w-13 sm:h-14 border border-amber-900/45 flex flex-col items-center justify-center relative cursor-pointer transition-colors ${
                          isSel
                            ? 'bg-yellow-400/55'
                            : isTarget
                            ? 'bg-yellow-300/45'
                            : 'hover:bg-amber-200/40'
                        }`}
                      >
                        {p && lbl && (
                          <div
                            className={`w-8 h-9 sm:w-10 sm:h-11 rounded-md border flex flex-col items-center justify-center shadow-sm ${
                              p.owner === 'sente'
                                ? 'bg-[#FFFBEB] border-amber-800 text-black'
                                : 'bg-[#0C0B08] border-yellow-500/50 text-yellow-300 rotate-180'
                            }`}
                          >
                            <span
                              className={`text-sm sm:text-base font-bold leading-none ${
                                p.promoted ? 'text-rose-600' : ''
                              }`}
                            >
                              {p.promoted ? lbl.promotedKanji : lbl.kanji}
                            </span>
                            <span className="text-[10px] font-mono font-bold opacity-85">
                              {p.promoted ? `+${lbl.eng}` : lbl.eng}
                            </span>
                          </div>
                        )}
                        {isTarget && !p && (
                          <span className="w-3 h-3 rounded-full bg-black/75 ring-2 ring-yellow-300 pointer-events-none" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Komadai (Captured Piece Hand Stand for Drops) */}
              <div className="w-full max-w-lg p-3.5 bg-[#12110B] border border-yellow-500/35 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs sm:text-sm font-mono font-bold text-yellow-300">
                  Komadai Hand (Click to Drop Captured Piece):
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {shogiCapturedHand.length === 0 ? (
                    <span className="text-xs text-neutral-400 font-mono">No captured pieces in hand</span>
                  ) : (
                    shogiCapturedHand.map((pt, idx) => (
                      <button
                        key={`${pt}_${idx}`}
                        type="button"
                        onClick={() =>
                          setSelectedDropType((prev) => (prev === pt ? null : pt))
                        }
                        className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border cursor-pointer ${
                          selectedDropType === pt
                            ? 'bg-yellow-400 text-black border-white'
                            : 'bg-[#1B1910] text-yellow-200 border-yellow-500/40 hover:border-yellow-300'
                        }`}
                      >
                        Drop {SHOGI_LABELS[pt].kanji} ({pt})
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 5. GO (9x9 / 13x13 / 19x19) BOARD */}
          {mode === 'go' && (
            <div className="space-y-4 flex flex-col items-center">
              <div
                style={{ gridTemplateColumns: `repeat(${goSize}, minmax(0, 1fr))` }}
                className="grid bg-[#D4A359] p-3 border-2 border-yellow-500/60 rounded-xl shadow-2xl gap-0"
              >
                {goBoard.map((row, r) =>
                  row.map((stone, c) => (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      onClick={() => handleGoIntersectionClick(r, c)}
                      className={`${
                        goSize === 19 ? 'w-6 h-6' : goSize === 13 ? 'w-8 h-8' : 'w-11 h-11'
                      } relative flex items-center justify-center cursor-pointer group`}
                    >
                      <div className="absolute inset-x-0 h-[1px] bg-black/70 pointer-events-none" />
                      <div className="absolute inset-y-0 w-[1px] bg-black/70 pointer-events-none" />
                      {stone ? (
                        <div
                          className={`z-10 ${
                            goSize === 19 ? 'w-5 h-5' : goSize === 13 ? 'w-6 h-6' : 'w-8 h-8'
                          } rounded-full shadow-md ${
                            stone === 'B'
                              ? 'bg-[#080808] border border-yellow-500/60'
                              : 'bg-[#FEFCE8] border border-amber-900/50'
                          }`}
                        />
                      ) : (
                        <div className="z-10 w-3 h-3 rounded-full bg-yellow-400/0 group-hover:bg-yellow-400/75 transition-colors" />
                      )}
                    </button>
                  ))
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <span className="text-xs sm:text-sm font-mono text-yellow-100">
                  Black Prisoners: <strong className="text-yellow-400">{goBlackPrisoners}</strong> · White Prisoners:{' '}
                  <strong className="text-amber-300">{goWhitePrisoners}</strong> (Komi +6.5)
                </span>
                <button
                  type="button"
                  onClick={scoreAndFinishGoMatch}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold text-black bg-yellow-400 hover:bg-yellow-300 rounded-xl cursor-pointer shadow-md"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Pass &amp; Score Territory (Open Go Win Menu)</span>
                </button>
              </div>
            </div>
          )}

          {/* 6. SUDOKU (9x9 LOGIC GRID) */}
          {mode === 'sudoku' && (
            <div className="space-y-5 flex flex-col items-center">
              <div className="grid grid-cols-9 border-2 border-yellow-400/70 rounded-xl overflow-hidden bg-[#090906] shadow-2xl">
                {sudokuGrid.map((row, r) =>
                  row.map((val, c) => {
                    const isSel = sudokuSelected[0] === r && sudokuSelected[1] === c;
                    const isFixed = sudokuFixed[r][c];
                    const conflict = hasSudokuConflict(r, c, val);
                    const cellNotes = sudokuNotes[`${r},${c}`] || [];
                    const rightThick = c === 2 || c === 5 ? 'border-r-2 border-r-yellow-400/70' : 'border-r border-r-yellow-500/20';
                    const bottomThick = r === 2 || r === 5 ? 'border-b-2 border-b-yellow-400/70' : 'border-b border-b-yellow-500/20';

                    return (
                      <button
                        key={`${r}-${c}`}
                        type="button"
                        onClick={() => setSudokuSelected([r, c])}
                        className={`w-11 h-11 sm:w-13 sm:h-13 flex items-center justify-center font-mono text-lg relative cursor-pointer transition-colors ${rightThick} ${bottomThick} ${
                          isSel
                            ? 'bg-yellow-400/30 ring-2 ring-inset ring-yellow-300'
                            : conflict
                            ? 'bg-rose-950/90 text-rose-300 font-bold'
                            : isFixed
                            ? 'bg-[#16150E] text-yellow-100 font-bold'
                            : 'bg-[#0B0A07] text-yellow-400 hover:bg-[#1A180F]'
                        }`}
                      >
                        {val > 0 ? (
                          val
                        ) : cellNotes.length > 0 ? (
                          <div className="grid grid-cols-3 gap-0.5 text-[10px] text-amber-300 leading-none">
                            {cellNotes.map((n) => (
                              <span key={n}>{n}</span>
                            ))}
                          </div>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => enterSudokuDigit(num)}
                    className="w-10 h-10 rounded-xl bg-[#15140D] hover:bg-yellow-400 hover:text-black text-yellow-100 border border-yellow-500/35 font-mono font-bold text-sm transition-colors cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => enterSudokuDigit(0)}
                  className="px-3.5 h-10 rounded-xl bg-[#15140D] hover:bg-amber-500 hover:text-black text-yellow-200 border border-yellow-500/35 font-mono font-bold text-xs cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setSudokuNotesMode((prev) => !prev)}
                  className={`px-3.5 h-10 rounded-xl font-mono text-xs font-bold border cursor-pointer ${
                    sudokuNotesMode
                      ? 'bg-yellow-400 text-black border-yellow-200'
                      : 'bg-[#15140D] text-yellow-200 border-yellow-500/35'
                  }`}
                >
                  {sudokuNotesMode ? 'Notes ON' : 'Notes OFF'}
                </button>
                <button
                  type="button"
                  onClick={revealSudokuHint}
                  className="flex items-center gap-1 px-3.5 h-10 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-mono text-xs font-bold cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Hint</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right 4 Cols: Live Telemetry, Shortest Path / Score Inspector & Move Log */}
        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-2xl bg-[#0B0A07] border border-yellow-500/35 p-5 space-y-4 shadow-xl">
            <h2 className="text-base font-bold text-yellow-400 font-display flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Live Match Telemetry &amp; Move Inspector</span>
            </h2>

            {mode === 'corridor' && (
              <div className="space-y-2.5 text-xs sm:text-sm font-mono">
                <div className="flex justify-between p-3 rounded-xl bg-[#13120C] border border-yellow-500/25">
                  <span className="text-neutral-200">Your Shortest Path (BFS)</span>
                  <span className="text-yellow-400 font-bold">{corridorPaths.p1Dist} Steps</span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-[#13120C] border border-yellow-500/25">
                  <span className="text-neutral-200">Peer Shortest Path (BFS)</span>
                  <span className="text-amber-400 font-bold">{corridorPaths.p2Dist} Steps</span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-[#13120C] border border-yellow-500/25">
                  <span className="text-neutral-200">Active Fences Placed</span>
                  <span className="text-yellow-200 font-bold">{corridorWalls.length} / 20</span>
                </div>
              </div>
            )}

            {mode === 'reversi' && (
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-xl bg-[#13120C] border border-yellow-500/30">
                  <div className="text-xs text-neutral-300">Your Gold Discs</div>
                  <div className="text-2xl font-mono font-bold text-yellow-400 mt-1">{reversiScores.b}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#13120C] border border-yellow-500/30">
                  <div className="text-xs text-neutral-300">Peer Obsidian Discs</div>
                  <div className="text-2xl font-mono font-bold text-yellow-100 mt-1">{reversiScores.w}</div>
                </div>
              </div>
            )}

            {mode === 'shogi' && (
              <div className="space-y-2 text-xs sm:text-sm text-neutral-200">
                <div className="p-3 rounded-xl bg-[#13120C] border border-yellow-500/25 flex justify-between font-mono">
                  <span>Komadai Hand Pieces</span>
                  <span className="text-yellow-400 font-bold">{shogiCapturedHand.length} Ready to Drop</span>
                </div>
                <div className="p-3 rounded-xl bg-[#13120C] border border-yellow-500/25 flex justify-between font-mono">
                  <span>Promotion Ranks</span>
                  <span className="text-yellow-200">Top 3 Rows (Ranks 1–3)</span>
                </div>
              </div>
            )}

            {mode === 'go' && (
              <div className="space-y-2 text-xs sm:text-sm font-mono">
                <div className="p-3 rounded-xl bg-[#13120C] border border-yellow-500/25 flex justify-between">
                  <span className="text-neutral-200">Black Prisoners Captured</span>
                  <span className="text-yellow-400 font-bold">{goBlackPrisoners}</span>
                </div>
                <div className="p-3 rounded-xl bg-[#13120C] border border-yellow-500/25 flex justify-between">
                  <span className="text-neutral-200">White Prisoners + Komi</span>
                  <span className="text-amber-300 font-bold">{goWhitePrisoners} (+6.5 Komi)</span>
                </div>
              </div>
            )}

            {mode === 'sudoku' && (
              <div className="space-y-2 text-xs sm:text-sm font-mono">
                <div className="p-3 rounded-xl bg-[#13120C] border border-yellow-500/25 flex justify-between">
                  <span className="text-neutral-200">Filled Cells</span>
                  <span className="text-yellow-400 font-bold">
                    {sudokuGrid.flat().filter((v) => v > 0).length} / 81
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#13120C] border border-yellow-500/25 flex justify-between">
                  <span className="text-neutral-200">Hints Used</span>
                  <span className="text-yellow-200 font-bold">{sudokuHintsUsed}</span>
                </div>
              </div>
            )}

            {(mode === 'chess' || mode === 'corridor') && (
              <div className="space-y-2">
                <div className="text-xs font-mono text-yellow-300 uppercase">Algebraic / Coordinate Move Log</div>
                <div className="max-h-44 overflow-y-auto bg-[#080806] border border-yellow-500/20 rounded-xl p-3 font-mono text-xs text-yellow-100 space-y-1">
                  {(mode === 'chess' ? chessLog : corridorLog).length === 0 ? (
                    <span className="text-neutral-400">No moves recorded yet.</span>
                  ) : (
                    (mode === 'chess' ? chessLog : corridorLog).map((entry, idx) => (
                      <div key={idx}>
                        {idx + 1}. {entry}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dedicated Per-Game Victory & Match Complete Modal */}
      <GameWinMenuModal
        payload={winMenuPayload}
        onPlayAgain={handlePlayAgain}
        onDismiss={dismissWinMenu}
        switchGameOptions={BOARD_GAME_TABS}
        onSwitchGame={(nextId) => setMode(nextId as BoardGameMode)}
      />
    </div>
  );
};
