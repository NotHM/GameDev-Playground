# AetherDeck Arcade & P2P GamePlayer

A decentralized, offline-first cross-platform multiplayer card table, board game arena, and WebAssembly/Phaser retro emulator built on a modular 5-pillar architecture.

## 1. Overview & Core Concept
- **What It Does:** Runs natively via `jsgamelauncher` (`npx rungame`) or any standard web runtime, leverages `WebAssembly.Memory` linear buffers and GPU shader pipelines (`gpu.js` / WebGL2) for 60fps retro arcade emulation, connects peers over encrypted P2P mesh WebSockets, handles cryptographic ECDSA/AES-GCM player identity and signed save ledgers, and includes local autonomous developer agents powered by Liquid Foundation Models (LFM).
- **Target Audience:** Indie developers, offline-first co-op & competitive gamers, and retro enthusiasts building resilient self-hosted gaming networks.
- **Four Core Views:**
  1. **Card Games:** Texas Hold'em Poker, Casino Blackjack (21), Klondike Solitaire, UNO, and **78-Card Tarot** (French Tarot Trick-Taking with 21 Atouts, Excuse, Cavaliers, Oudlers & Chien + Arcana 3-Card Fate Duel) — all with Official Rules references and P2P multiplayer table synchronization.
  2. **Board Games:** Grandmaster Chess (castling, promotion, coordinate grid), Checkers (forced jumps & crowning), Reversi (Othello with flip previews), **Corridor (Quoridor)** (9x9 abstract race with 10 fences per player, face-to-face jumps, and BFS path validation), **9x9 Shogi** (Japanese Chess with promotion zone, bilingual Kanji/English tiles, Komadai drop stand, and Nifu rule), **Go (Baduk / Weiqi)** (`9x9`, `13x13`, `19x19` with group liberty calculation, prisoner capture, and Komi scoring), and **9x9 Sudoku** (Easy/Medium/Hard, Pencil Notes, and conflict checking) — each with a readable Official Rules & Piece Legend panel.
  3. **Emulator:** 60fps Phaser + `WebAssembly.Memory` retro console with **Searchable Retro & Old Games Catalog**, **Custom ROM / Save File Upload & Export** (`.json`, `.rom`, `.wasm`, `.bin`, `.sav`), **5 Switchable Virtual Controllers** (SNES 16-Bit Cross Pad, Arcade 8-Way Fight Stick, Dual-Analog Pro Pad, Rotary Paddle & Spinner Dial, Compact Handheld Touch Bar), real-time Hex Memory Inspector & Byte Patcher (`memoryjs` workflow), and GPU CRT/Phosphor shader pipelines.
  4. **Profile & Leaderboard:** Simple Leaderboard with **Daily Win Points** (**1 point per game won per day, capped at 50 max per day**), **P2P-Only Point Betting Escrow**, Decentralized Cryptographic Identity (ECDSA P-256 + AES-256-GCM), Signed Save-State Ledger, and Bluetooth Gamepad Mapper.

## 2. Quickstart Instructions

### Browser / Full-Stack P2P Node
```bash
npm install
npm run dev
# Server + P2P Mesh WebSocket Relay listens on http://0.0.0.0:3000
```

### Browserless Native Desktop / Handheld Execution (`jsgamelauncher`)
```bash
npx rungame ./web/phaserEmulator.ts --fullscreen --gamepad-sdl
```

### Local Autonomous Agents (`/dev-tools/agents/`)
Headless developer tool suite providing:
- **Liquid Foundation Models (`liquidModels.ts`):** Continuous-time state-space model adapters (`lfm-1.1b-nano`, `lfm-3b-edge`, `lfm-7b-liquid`, `lfm-40b-moe`).
- **Hardware & Compatibility Detector (`hardwareDetector.ts`):** Probes CPU cores, system RAM, WebAssembly 128-bit SIMD/threads, WebGPU/WebGL2, and Gamepad API to select optimal LFM quantization tiers.
- **Asset Creation Agents (`assetCreationAgents.ts`):** Autonomous generators for spritesheets, procedural SFX & chiptunes, JSON tilemaps, WGSL/GLSL shaders, Tarot/Shogi/Go SVG art, and UI color palettes.
- **Universal Playtesting Agent (`playtestAgents.ts`):** Automated headless playtester capable of fuzzing card games, board games, Wasm ROMs, and the 50/day P2P point economy.

## 3. Five-Pillar Directory Layout
- `/server` — P2P Mesh & WebSocket Room Sync, Cryptographic Auth, AES-GCM Encryption Engine, and Immutable Save Ledger with Daily Win Points (50/day cap) & P2P Point Betting.
- `/components` — Cross-Platform HUD, 5 Switchable Virtual Controllers, Unified Input Mapper, and Full-Viewport Views.
- `/app` — OS Native Runtime Bindings (`jsgamelauncher` bridge, Web Audio procedural synth) and Bluetooth Peripheral & Haptic Manager.
- `/web` — Phaser 2D Game Core, `WebAssembly.Memory` Linear Allocator & Hex Patcher, and GPU Compute Shader Pipeline.
- `/dev-tools` — Headless Autonomous Agents (`liquidModels.ts`, `hardwareDetector.ts`, `assetCreationAgents.ts`, `playtestAgents.ts`) and Programmable SVG Sprite Generator skills.
