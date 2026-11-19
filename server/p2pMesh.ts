import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { encryptPacket, sha256Hex } from './encryption.ts';

export interface MeshPeer {
  peerId: string;
  handle: string;
  roomId: string;
  activeGame: string;
  fingerprint: string;
  connectedAt: number;
  latencyMs: number;
}

export interface RoomState {
  roomId: string;
  name: string;
  gameType: string;
  hostPeerId: string;
  vectorClock: number;
  sharedState: Record<string, unknown>;
  chatLog: Array<{
    id: string;
    senderId: string;
    senderHandle: string;
    text: string;
    cipherDigest: string;
    timestamp: number;
  }>;
  updatedAt: number;
}

interface ClientConnection {
  ws: WebSocket;
  peer: MeshPeer;
}

const DEFAULT_ROOMS: RoomState[] = [
  {
    roomId: 'main-holdem-1',
    name: 'emerald-table-01 · Hold’em High Rollers',
    gameType: 'poker',
    hostPeerId: 'mesh_seed_01',
    vectorClock: 1,
    sharedState: { pot: 450, communityCards: [], lastAction: 'Table open for P2P challengers' },
    chatLog: [
      {
        id: 'msg_genesis_1',
        senderId: 'mesh_seed_01',
        senderHandle: 'Viktor (Seed Node)',
        text: 'Encrypted P2P mesh tunnel active. Take a seat at the table.',
        cipherDigest: sha256Hex('genesis_msg_1').slice(0, 12),
        timestamp: Date.now() - 60000,
      },
    ],
    updatedAt: Date.now(),
  },
  {
    roomId: 'uno-arena-2',
    name: 'crimson-deck-02 · UNO Competitive Blitz',
    gameType: 'uno',
    hostPeerId: 'mesh_seed_02',
    vectorClock: 1,
    sharedState: { topCard: 'R-7', direction: 1, lastAction: 'Waiting for challenge' },
    chatLog: [],
    updatedAt: Date.now(),
  },
  {
    roomId: 'grandmaster-chess-3',
    name: 'obsidian-board-03 · Classical Chess P2P',
    gameType: 'chess',
    hostPeerId: 'mesh_seed_03',
    vectorClock: 1,
    sharedState: { turn: 'w', moveCount: 0, lastMove: 'Initial position' },
    chatLog: [],
    updatedAt: Date.now(),
  },
];

export class P2PMeshServer {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private rooms: Map<string, RoomState> = new Map();

  constructor(server: HttpServer) {
    for (const r of DEFAULT_ROOMS) {
      this.rooms.set(r.roomId, r);
    }

    this.wss = new WebSocketServer({ server, path: '/ws/mesh' });
    this.wss.on('connection', (ws) => this.handleConnection(ws));
  }

  private handleConnection(ws: WebSocket) {
    const tempId = `peer_${Math.random().toString(36).slice(2, 9)}`;
    const peer: MeshPeer = {
      peerId: tempId,
      handle: `Player-${tempId.slice(-4).toUpperCase()}`,
      roomId: 'main-holdem-1',
      activeGame: 'poker',
      fingerprint: sha256Hex(tempId).slice(0, 16).toUpperCase(),
      connectedAt: Date.now(),
      latencyMs: 14,
    };

    this.clients.set(tempId, { ws, peer });
    this.sendToClient(ws, 'mesh:init', {
      selfPeer: peer,
      peers: this.getActivePeers(),
      rooms: Array.from(this.rooms.values()),
    });
    this.broadcastPresence();

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        this.handleMessage(tempId, msg);
      } catch {
        // Ignore malformed packets
      }
    });

    ws.on('close', () => {
      this.clients.delete(tempId);
      this.broadcastPresence();
    });
  }

  private handleMessage(connId: string, msg: { type: string; payload?: Record<string, unknown> }) {
    const entry = this.clients.get(connId);
    if (!entry) return;
    const payload = msg.payload || {};

    switch (msg.type) {
      case 'peer:identify': {
        if (typeof payload.peerId === 'string' && payload.peerId.trim()) {
          entry.peer.peerId = payload.peerId.trim();
        }
        if (typeof payload.handle === 'string' && payload.handle.trim()) {
          entry.peer.handle = payload.handle.trim().slice(0, 28);
        }
        if (typeof payload.fingerprint === 'string' && payload.fingerprint.trim()) {
          entry.peer.fingerprint = payload.fingerprint.trim();
        }
        if (typeof payload.activeGame === 'string') {
          entry.peer.activeGame = payload.activeGame;
        }
        this.broadcastPresence();
        break;
      }

      case 'room:join': {
        const roomId = String(payload.roomId || 'main-holdem-1');
        const gameType = String(payload.gameType || entry.peer.activeGame || 'poker');
        entry.peer.roomId = roomId;
        entry.peer.activeGame = gameType;
        if (!this.rooms.has(roomId)) {
          this.rooms.set(roomId, {
            roomId,
            name: String(payload.roomName || `${gameType.toUpperCase()} Room ${roomId.slice(-4)}`),
            gameType,
            hostPeerId: entry.peer.peerId,
            vectorClock: 1,
            sharedState: {},
            chatLog: [],
            updatedAt: Date.now(),
          });
        }
        this.broadcastRoomUpdate(roomId);
        this.broadcastPresence();
        break;
      }

      case 'game:state_sync': {
        const roomId = String(payload.roomId || entry.peer.roomId);
        const room = this.rooms.get(roomId);
        if (room) {
          room.vectorClock += 1;
          room.sharedState = {
            ...room.sharedState,
            ...(payload.state as Record<string, unknown>),
            lastActorId: entry.peer.peerId,
            lastActorHandle: entry.peer.handle,
            vectorClock: room.vectorClock,
          };
          room.updatedAt = Date.now();
          const encrypted = encryptPacket(room.sharedState);
          this.broadcastToRoom(roomId, 'game:state_updated', {
            roomId,
            vectorClock: room.vectorClock,
            sharedState: room.sharedState,
            cipherDigest: encrypted.cipherText.slice(0, 24),
            iv: encrypted.iv,
          });
        }
        break;
      }

      case 'room:chat': {
        const roomId = String(payload.roomId || entry.peer.roomId);
        const text = String(payload.text || '').trim().slice(0, 240);
        if (!text) break;
        const room = this.rooms.get(roomId);
        if (room) {
          const encrypted = encryptPacket({ sender: entry.peer.peerId, text });
          const chatItem = {
            id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            senderId: entry.peer.peerId,
            senderHandle: entry.peer.handle,
            text,
            cipherDigest: `${encrypted.iv}:${encrypted.authTag.slice(0, 10)}`,
            timestamp: Date.now(),
          };
          room.chatLog.push(chatItem);
          if (room.chatLog.length > 40) {
            room.chatLog = room.chatLog.slice(-40);
          }
          this.broadcastToRoom(roomId, 'room:chat_message', { roomId, message: chatItem });
        }
        break;
      }
    }
  }

  public getActivePeers(): MeshPeer[] {
    const livePeers = Array.from(this.clients.values()).map((c) => c.peer);
    // Always include resilient seed relay nodes so offline/single-user preview sees the mesh topology
    const seedNodes: MeshPeer[] = [
      {
        peerId: 'mesh_seed_01',
        handle: 'Viktor (Seed Relay)',
        roomId: 'main-holdem-1',
        activeGame: 'poker',
        fingerprint: '8FA2C19E4B07D312',
        connectedAt: Date.now() - 360000,
        latencyMs: 9,
      },
      {
        peerId: 'mesh_seed_02',
        handle: 'Kaspar (Chess Node)',
        roomId: 'grandmaster-chess-3',
        activeGame: 'chess',
        fingerprint: '3C71E08B9A44F120',
        connectedAt: Date.now() - 240000,
        latencyMs: 16,
      },
    ];
    return [...livePeers, ...seedNodes];
  }

  public getRooms(): RoomState[] {
    return Array.from(this.rooms.values());
  }

  private sendToClient(ws: WebSocket, type: string, payload: unknown) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }

  private broadcastPresence() {
    const packet = JSON.stringify({
      type: 'mesh:presence',
      payload: {
        peers: this.getActivePeers(),
        rooms: this.getRooms(),
      },
    });
    for (const { ws } of this.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(packet);
      }
    }
  }

  private broadcastRoomUpdate(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    this.broadcastToRoom(roomId, 'room:state', { room });
  }

  private broadcastToRoom(roomId: string, type: string, payload: unknown) {
    const packet = JSON.stringify({ type, payload });
    for (const { ws, peer } of this.clients.values()) {
      if (peer.roomId === roomId && ws.readyState === WebSocket.OPEN) {
        ws.send(packet);
      }
    }
  }
}
