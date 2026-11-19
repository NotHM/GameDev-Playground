import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createPlayerIdentity, verifySessionToken } from './server/auth.ts';
import { encryptPacket, decryptPacket } from './server/encryption.ts';
import { ledger, DAILY_POINT_CAP } from './server/ledger.ts';
import { P2PMeshServer } from './server/p2pMesh.ts';
import { aiRouter } from './server/aiRoutes.ts';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // Initialize P2P Mesh WebSocket Relay on /ws/mesh
  const meshServer = new P2PMeshServer(server);

  // Mount Server-Side Lyria 3 & AI Routes
  app.use('/api/ai', aiRouter);

  // Auth & Cryptographic Identity Endpoints
  app.post('/api/auth/identity', (req, res) => {
    const { handle, publicKeyHint } = req.body || {};
    const identity = createPlayerIdentity(handle || 'Crimson Ace', publicKeyHint);
    const profile = ledger.getOrCreateProfile(
      identity.playerId,
      identity.handle,
      identity.publicKeyFingerprint
    );
    res.json({ identity, profile, dailyPointCap: DAILY_POINT_CAP });
  });

  app.post('/api/auth/verify', (req, res) => {
    const { sessionToken } = req.body || {};
    const result = verifySessionToken(sessionToken || '');
    res.json(result);
  });

  // State Ledger, Leaderboard & Daily Points Endpoints
  app.get('/api/ledger', (req, res) => {
    const playerId = String(req.query.playerId || 'peer_default');
    const handle = String(req.query.handle || 'Crimson Ace');
    const fingerprint = String(req.query.fingerprint || '');
    const profile = ledger.getOrCreateProfile(playerId, handle, fingerprint);
    res.json({
      profile,
      dailyPointCap: DAILY_POINT_CAP,
      blocks: ledger.getRecentBlocks(25),
      leaderboard: ledger.getLeaderboard(),
      peers: meshServer.getActivePeers(),
      rooms: meshServer.getRooms(),
    });
  });

  app.post('/api/ledger/commit', (req, res) => {
    const {
      playerId,
      handle,
      fingerprint,
      gameType,
      summary,
      chipsDelta,
      outcome,
      isP2PServerRoom,
      p2pPointWager,
      statePayload,
    } = req.body || {};
    const result = ledger.commitGameBlock({
      playerId: String(playerId || 'peer_default'),
      handle: String(handle || 'Crimson Ace'),
      fingerprint: String(fingerprint || ''),
      gameType: String(gameType || 'POKER'),
      summary: String(summary || 'Completed round'),
      chipsDelta: Number(chipsDelta || 0),
      outcome,
      isP2PServerRoom: Boolean(isP2PServerRoom ?? true),
      p2pPointWager: Number(p2pPointWager || 0),
      statePayload: statePayload || {},
    });
    res.json({
      ...result,
      dailyPointCap: DAILY_POINT_CAP,
      blocks: ledger.getRecentBlocks(25),
      leaderboard: ledger.getLeaderboard(),
    });
  });

  // P2P-Only Point Betting Escrow Endpoint
  app.post('/api/ledger/bet-points', (req, res) => {
    const { playerId, handle, fingerprint, roomId, isP2PServerConnected, stakePoints } = req.body || {};
    const result = ledger.placeP2PPointBet({
      playerId: String(playerId || 'peer_default'),
      handle: String(handle || 'Crimson Ace'),
      fingerprint: String(fingerprint || ''),
      roomId: String(roomId || ''),
      isP2PServerConnected: Boolean(isP2PServerConnected),
      stakePoints: Number(stakePoints || 0),
    });
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    res.json({
      ...result,
      leaderboard: ledger.getLeaderboard(),
    });
  });

  // Upload Custom ROM / Save File Endpoint
  app.post('/api/emulator/upload-rom', (req, res) => {
    const { playerId, handle, fingerprint, rom } = req.body || {};
    if (!rom || !rom.title) {
      res.status(400).json({ error: 'Invalid ROM payload' });
      return;
    }
    const profile = ledger.registerUploadedRom({
      playerId: String(playerId || 'peer_default'),
      handle: String(handle || 'Crimson Ace'),
      fingerprint: String(fingerprint || ''),
      rom: {
        romKey: String(rom.romKey || `custom_${Date.now()}`),
        title: String(rom.title).slice(0, 48),
        system: String(rom.system || 'Custom Wasm-64'),
        genre: String(rom.genre || 'Arcade Homebrew'),
        year: Number(rom.year || 2026),
        baseRomId: Number(rom.baseRomId || 1),
        speedScale: Number(rom.speedScale || 100),
        lives: Number(rom.lives || 3),
        hexDump: typeof rom.hexDump === 'string' ? rom.hexDump : undefined,
        uploadedAt: Date.now(),
      },
    });
    res.json({ profile });
  });

  // AES-256-GCM Packet Inspection Endpoint for Profile Crypto Console
  app.post('/api/crypto/seal', (req, res) => {
    const { payload, secret } = req.body || {};
    const envelope = encryptPacket(payload || { ping: true }, secret);
    const verifiedPlaintext = decryptPacket(envelope, secret);
    res.json({ envelope, verifiedPlaintext });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`P2P GamePlayer 5-Pillar Server + P2P Mesh listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
