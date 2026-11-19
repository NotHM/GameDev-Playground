# Product Roadmap & Version Milestones

## V0 (MVC — Core Runtime, Classical Tables & Wasm Memory)
- Core 60fps game loop running in Phaser and isolated HTML5 Canvas containers.
- Local state management using `WebAssembly.Memory` linear byte buffers (`64KB` pages) with deterministic frame snapshots.
- Unified keyboard (`WASD`, Arrows, `Space`, `Enter`, `Esc`), SDL/Gamepad, and multi-layout **Virtual Controllers** (SNES 16-Bit Pad, Arcade 8-Way Fight Stick, Dual-Analog Pad, Rotary Paddle Dial, Touch Matrix).
- Local cryptographic save-state persistence with SHA-256 integrity hashes.

## V0.5 (PlayTest — Expanded Tabletop Suite, ROM Loader & P2P Discovery)
- Integration of `jsgamelauncher` (`npx rungame`) for browserless execution on Linux handhelds and desktop environments.
- Complete **Card Games Suite**: Texas Hold'em Poker, Casino Blackjack (21), Klondike Solitaire, UNO, and **78-Card French Tarot & Arcana Duel**.
- Complete **Board & Logic Games Suite**: Rule-verified Grandmaster Chess, Checkers, Reversi (Othello), **9x9 Shogi** (with piece drops & promotion), **Go** (9x9, 13x13, 19x19 with liberty capture), and **9x9 Sudoku**.
- **Emulator User ROM Upload & Retro Search Engine**: Upload custom `.rom`, `.wasm`, `.bin`, or `.json` save/game cartridges and search an indexed retro & homebrew game library.

## V1 (Public Release — Daily Win Points, P2P-Only Betting & Hardware Detection)
- **Simple Leaderboard & Daily Point Economy**: Players earn **1 point per game won per day** (capped at **50 points/day**).
- **P2P-Only Point Wagering**: Earned points can be staked exclusively on live P2P servers via room escrow.
- **Hardware & Compatibility Detector**: Real-time probing of CPU threads, WebAssembly SIMD, WebGPU/WebGL2 shader limits, RAM ceiling, and connected controllers.
- Full AES-256-GCM encrypted P2P packet streams and cryptographic player identity tokens.

## V2 (Autonomous Game Ecosystem — Liquid Models, Asset Agents & Playtesters)
- **Out-of-the-Box Liquid Foundation Models (LFM)**: Native support for `LFM-1.1B-Nano`, `LFM-3B-Edge`, `LFM-7B-Liquid`, and `LFM-40B-MoE` running locally with automatic hardware quantization selection (`Q4_K_M`, `Q8_0`, `FP16`).
- **Universal Asset Creation Agents (`/dev-tools/agents/`)**: Autonomous local agents for generating 2D sprite sheets, procedural SFX/chiptune audio, Tiled JSON tilemaps, WGSL/GLSL shaders, vector card/board art, and accessible UI themes.
- **Autonomous Playtesting Agents (`/dev-tools/agents/`)**: Headless playtesters capable of verifying any card game (Monte-Carlo EV), board game (Minimax/MCTS rule validation), or emulator ROM (60fps frame-input fuzzing & Wasm memory invariant verification).
