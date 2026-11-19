# System Architecture & Memory Layout

## 1. Five-Pillar Data Flow

```
+-------------------------------------------------------------------------+
|                        COMPONENTS PILLAR (/components)                  |
|  TitleScreen Shell  |  Low-Occlusion HUD  |  Unified InputMapper        |
+----------+----------------------+------------------------+--------------+
           |                      |                        |
           v                      v                        v
+--------------------+  +--------------------+  +-------------------------+
|  APP PILLAR (/app) |  |  WEB PILLAR (/web) |  | DEV TOOLS (/dev-tools)  |
| - nativeBindings   |  | - phaserEmulator   |  | - sprite-sheet-generator|
| - peripheralMgr    |  | - wasmMemory       |  | - npcEngine (Argon HIGH)|
| - WebAudio Synth   |  | - gpuCompute       |  | - telemetryBalancer     |
+---------+----------+  +---------+----------+  +------------+------------+
          |                       |                          |
          +-----------------------+--------------------------+
                                  |
                                  v
+-------------------------------------------------------------------------+
|                          SERVER PILLAR (/server)                        |
|  P2P Mesh WebSocket Relay  |  ECDSA Auth  |  AES-GCM  |  Hash Ledger    |
+-------------------------------------------------------------------------+
```

## 2. WebAssembly Linear Memory Layout (`/web/wasmMemory.ts`)
Each emulator instance allocates a 1-page (`65,536` bytes) `WebAssembly.Memory` buffer partitioned as follows:

| Address Range       | Register / Region         | Description                                           |
| ------------------- | ------------------------- | ----------------------------------------------------- |
| `0x0000 - 0x0003`   | `MAGIC_HEADER`            | ASCII `'AETH'` (`0x41 0x45 0x54 0x48`)                |
| `0x0004 - 0x0007`   | `ROM_ID`                  | Active cartridge ID (`1=Breakout, 2=Serpent, 3=Ast`)  |
| `0x0008 - 0x000B`   | `SCORE_UINT32`            | Little-endian 32-bit player score                     |
| `0x000C - 0x000F`   | `HI_SCORE_UINT32`         | Little-endian 32-bit high score                       |
| `0x0010`            | `LIVES_UINT8`             | Remaining player lives (patchable via Memory UI)      |
| `0x0011`            | `LEVEL_UINT8`             | Current wave / difficulty tier                        |
| `0x0012`            | `SPEED_SCALE_UINT8`       | Simulation clock multiplier (`100` = `1.0x`)          |
| `0x0013`            | `FLAGS_BITMASK`           | Bit 0: Paused, Bit 1: GodMode/Invincible, Bit 2: CRT  |
| `0x0020 - 0x003F`   | `ENTITY_HERO_STRUCT`      | Hero `x, y, vx, vy, angle, cooldown` floats           |
| `0x0100 - 0x0FFF`   | `ENTITY_POOL_BUFFER`      | Packed array of active bricks, segments, or asteroids |
| `0x1000 - 0xFFFF`   | `FRAME_SNAPSHOT_RING`     | Rewind & instant save-state serialization ring buffer |

## 3. Cryptographic & P2P Security Model (`/server/auth.ts` & `/server/encryption.ts`)
- **Identity:** Clients generate an ECDSA P-256 keypair (or deterministic session keypair). Every ledger commit and P2P room action carries a public-key fingerprint and HMAC/signature digest.
- **Transport Encryption:** P2P payloads are encrypted with AES-256-GCM using a 96-bit initialization vector (`iv`) and 128-bit authentication tag (`authTag`).
- **Hash-Chained State Ledger:** Each save record in `/server/ledger.ts` includes `prevHash`, `timestamp`, `playerId`, `gameType`, `payload`, and `blockHash = SHA256(prevHash + timestamp + JSON(payload))`, preventing retroactive tampering and resolving peer desyncs via vector clock sequence numbers.
