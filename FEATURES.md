# Comprehensive Features Breakdown

## 1. Competitive Card Games Suite (`Card Games` View)
- **Texas Hold'em Poker:** Multi-street betting (Pre-Flop, Flop, Turn, River, Showdown), full 7-card hand evaluator, P2P multiplayer table sync, and readable rules sheet.
- **Casino Blackjack (21):** Multi-action shoe dealing (Hit, Stand, Double Down), soft/hard 17 dealer rules, and shared P2P table seating.
- **Klondike Solitaire:** Full 7-column tableau, 4 suit foundations, stock/waste cycling, and competitive P2P race sync.
- **UNO (Wild & Action Shedding):** 108-card deck dynamics with Skip, Reverse, Draw Two, Wild, and Wild Draw Four cards.
- **Tarot (78-Card French Tarot & Arcana Duel):** Full 78-card deck featuring 56 suited cards (`1–10`, `Valet`, `Cavalier/Knight`, `Dame`, `Roi`), 21 `Atouts` (Trumps `I–XXI`), and `The Excuse (0)`. Supports both classical French Tarot trick-taking with Oudlers (`1`, `21`, `Excuse`) point targets and Major Arcana Fate Duel.

## 2. Classical & Logic Board Games Arena (`Board Games` View)
Every board game includes a structured, readable **Official Rules & Piece Reference** panel:
- **Grandmaster Chess:** Complete legal move engine including castling, en passant, pawn promotion, check/checkmate detection, captured piece trays, and algebraic notation log.
- **Checkers (Draughts):** Mandatory jump captures, multi-jump chains, and King crowning on the 8th rank.
- **Reversi (Othello):** 8x8 disc enclosure validation, legal placement indicators, and live disc differential readout.
- **Shogi (9x9 Japanese Chess):** Standard 9x9 board with clear Kanji + English piece tiles (`K, R, B, G, S, N, L, P`), 3-rank promotion zone (`+R Dragon, +B Horse, +S, +N, +L, +P Tokin`), and interactive **Komadai (Captured Piece Drop Table)** obeying Nifu (two-pawn) drop restrictions.
- **Go (9x9, 13x13, 19x19):** Selectable grid dimensions, group liberty calculation, automatic prisoner capture of zero-liberty chains, suicide prevention, pass/komi (`6.5`), and territory scoring.
- **Sudoku (9x9 Logic Puzzle):** Interactive 9x9 grid with `Easy`, `Medium`, and `Hard` generators, Pencil Notes mode, real-time row/column/3x3 box conflict detection, and Hint validation.

## 3. Universal Retro Emulator & Virtual Controllers (`Emulator` View)
- **User ROM & Save File Loader:** Upload and run custom saved games or ROM cartridges (`.json`, `.rom`, `.wasm`, `.bin`, `.sav`) or export binary snapshots to disk.
- **Searchable Retro & Homebrew Catalog:** Instant search across classic arcade, vector, puzzle, and tabletop homebrew cartridges with one-click boot into `WebAssembly.Memory`.
- **5 Switchable Virtual Controllers:**
  1. `SNES 16-Bit Cross Pad` (D-Pad + Select/Start + ABXY Diamond + L/R Shoulders)
  2. `Arcade 8-Way Fight Stick` (8-Way Ball-Top Stick + 6-Button Street Layout)
  3. `Dual-Analog Thumbstick Pad` (Dual virtual sticks + triggers)
  4. `Rotary Paddle & Spinner Dial` (Precision angular dial + Fire button)
  5. `Compact Handheld Touch Bar` (Low-occlusion mobile thumb matrix)

## 4. Simple Leaderboard, Daily Win Points & P2P-Only Betting (`Profile` View)
- **Daily Win Points (1 pt/win, up to 50/day):** Players earn **1 point** per game won per day, strictly capped at **50 points per UTC day**.
- **P2P-Only Point Betting:** Earned points can be wagered **exclusively on P2P servers** against connected peers via room escrow.
- **Simple Leaderboard:** Clean ranked table tracking Player Handle, Daily Points (`X / 50`), Total Points, Wins, and P2P Escrow status.

## 5. Headless Agents, Liquid Models & Hardware Compatibility (`/dev-tools/agents/`)
- **Out-of-the-Box Liquid Foundation Models (`liquidModels.ts`):** Pre-configured adapters for `LFM-1.1B-Nano`, `LFM-3B-Edge`, `LFM-7B-Liquid`, and `LFM-40B-MoE`.
- **Hardware & Compatibility Detector (`hardwareDetector.ts`):** Probes CPU concurrency, WebAssembly SIMD/threads, WebGPU/WebGL2 capabilities, RAM ceiling, and SDL controllers.
- **All-Domain Asset Creation Agents (`assetCreationAgents.ts`):** Autonomous generators for sprites, procedural audio/SFX, tilemaps, WGSL/GLSL shaders, vector card/board art, and UI palettes.
- **Universal Playtesting Agents (`playtestAgents.ts`):** Automated headless playtesters for card games, board games, emulator ROMs, and P2P state sync.
