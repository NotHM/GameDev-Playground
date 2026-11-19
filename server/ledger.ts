import fs from 'fs';
import path from 'path';
import { encryptPacket, sha256Hex, EncryptedEnvelope } from './encryption.ts';

export interface LedgerBlock {
  index: number;
  blockHash: string;
  prevHash: string;
  timestamp: number;
  playerId: string;
  handle: string;
  gameType: string;
  vectorClock: number;
  summary: string;
  chipsDelta: number;
  pointsDelta: number;
  pointsAfter: number;
  bankrollAfter: number;
  encryptedState: EncryptedEnvelope;
}

export interface CustomUploadedRom {
  romKey: string;
  title: string;
  system: string;
  genre: string;
  year: number;
  baseRomId: number;
  speedScale: number;
  lives: number;
  hexDump?: string;
  uploadedAt: number;
}

export interface PlayerLedgerProfile {
  playerId: string;
  handle: string;
  publicKeyFingerprint: string;
  chips: number;
  points: number;
  dailyPointsEarned: number;
  lastPointDate: string;
  activeP2PPointBet: number;
  activeP2PRoomId: string | null;
  eloRating: number;
  wins: number;
  losses: number;
  gamesPlayed: number;
  savedRomStates: Record<string, { romId: number; score: number; lives: number; hexDump: string; updatedAt: number }>;
  uploadedRoms: CustomUploadedRom[];
  updatedAt: number;
}

interface LedgerStoreData {
  blocks: LedgerBlock[];
  profiles: Record<string, PlayerLedgerProfile>;
}

const LEDGER_FILE = path.resolve(process.cwd(), '.ledger-store.json');
export const DAILY_POINT_CAP = 50;

function todayUtcString(): string {
  return new Date().toISOString().slice(0, 10);
}

class StateLedger {
  private data: LedgerStoreData = {
    blocks: [],
    profiles: {},
  };

  constructor() {
    this.load();
    this.ensureSeedLeaderboard();
    if (this.data.blocks.length === 0) {
      const genesisEnvelope = encryptPacket({ genesis: true, protocol: 'AetherDeck-P2P-v1' });
      const genesisHash = sha256Hex(`0:GENESIS:0:${JSON.stringify(genesisEnvelope)}`);
      this.data.blocks.push({
        index: 0,
        blockHash: genesisHash,
        prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
        timestamp: Date.now(),
        playerId: 'system_genesis',
        handle: 'Genesis Node',
        gameType: 'SYSTEM',
        vectorClock: 1,
        summary: 'Initialized P2P state ledger (1 pt/win/day, max 50/day)',
        chipsDelta: 0,
        pointsDelta: 0,
        pointsAfter: 0,
        bankrollAfter: 5000,
        encryptedState: genesisEnvelope,
      });
      this.save();
    }
  }

  private ensureSeedLeaderboard() {
    const today = todayUtcString();
    const seeds: Array<{ id: string; handle: string; fp: string; points: number; daily: number; wins: number; losses: number; chips: number; elo: number }> = [
      { id: 'peer_seed_viktor', handle: 'Viktor (Hold’em Seed)', fp: '8FA2C19E4B07D312', points: 42, daily: 14, wins: 38, losses: 12, chips: 8400, elo: 1420 },
      { id: 'peer_seed_kaspar', handle: 'Kaspar (Shogi & Go Node)', fp: '3C71E08B9A44F120', points: 36, daily: 11, wins: 31, losses: 9, chips: 7250, elo: 1390 },
      { id: 'peer_seed_celeste', handle: 'Celeste (Tarot Master)', fp: '7D19A44E02B8C901', points: 29, daily: 8, wins: 25, losses: 10, chips: 6600, elo: 1315 },
      { id: 'peer_seed_akira', handle: 'Akira (Wasm Arcade)', fp: '5E80B32C19F4D110', points: 19, daily: 6, wins: 19, losses: 8, chips: 5900, elo: 1260 },
    ];
    for (const s of seeds) {
      if (!this.data.profiles[s.id]) {
        this.data.profiles[s.id] = {
          playerId: s.id,
          handle: s.handle,
          publicKeyFingerprint: s.fp,
          chips: s.chips,
          points: s.points,
          dailyPointsEarned: s.daily,
          lastPointDate: today,
          activeP2PPointBet: 0,
          activeP2PRoomId: 'main-holdem-1',
          eloRating: s.elo,
          wins: s.wins,
          losses: s.losses,
          gamesPlayed: s.wins + s.losses,
          savedRomStates: {},
          uploadedRoms: [],
          updatedAt: Date.now() - 120000,
        };
      }
    }
  }

  private load() {
    try {
      if (fs.existsSync(LEDGER_FILE)) {
        const raw = fs.readFileSync(LEDGER_FILE, 'utf8');
        this.data = JSON.parse(raw) as LedgerStoreData;
      }
    } catch {
      this.data = { blocks: [], profiles: {} };
    }
  }

  private save() {
    try {
      fs.writeFileSync(LEDGER_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch {
      // Ignore write errors on read-only filesystems
    }
  }

  private normalizeProfileDailyRollover(profile: PlayerLedgerProfile) {
    const today = todayUtcString();
    if (profile.lastPointDate !== today) {
      profile.dailyPointsEarned = 0;
      profile.lastPointDate = today;
    }
    if (typeof profile.points !== 'number') profile.points = 10;
    if (typeof profile.dailyPointsEarned !== 'number') profile.dailyPointsEarned = 0;
    if (typeof profile.activeP2PPointBet !== 'number') profile.activeP2PPointBet = 0;
    if (!Array.isArray(profile.uploadedRoms)) profile.uploadedRoms = [];
  }

  public getOrCreateProfile(playerId: string, handle: string, fingerprint: string): PlayerLedgerProfile {
    const existing = this.data.profiles[playerId];
    if (existing) {
      this.normalizeProfileDailyRollover(existing);
      if (handle && handle !== existing.handle) {
        existing.handle = handle;
      }
      return existing;
    }
    const created: PlayerLedgerProfile = {
      playerId,
      handle: handle || 'Crimson Ace',
      publicKeyFingerprint: fingerprint || sha256Hex(playerId).slice(0, 16).toUpperCase(),
      chips: 5000,
      points: 12, // Starting P2P point balance so players can test P2P point bets right away
      dailyPointsEarned: 2,
      lastPointDate: todayUtcString(),
      activeP2PPointBet: 0,
      activeP2PRoomId: 'main-holdem-1',
      eloRating: 1200,
      wins: 2,
      losses: 0,
      gamesPlayed: 2,
      savedRomStates: {},
      uploadedRoms: [],
      updatedAt: Date.now(),
    };
    this.data.profiles[playerId] = created;
    this.save();
    return created;
  }

  public placeP2PPointBet(params: {
    playerId: string;
    handle: string;
    fingerprint: string;
    roomId: string;
    isP2PServerConnected: boolean;
    stakePoints: number;
  }): { ok: boolean; error?: string; profile: PlayerLedgerProfile } {
    const profile = this.getOrCreateProfile(params.playerId, params.handle, params.fingerprint);

    if (!params.isP2PServerConnected || !params.roomId) {
      return {
        ok: false,
        error: 'Points can only be bet when connected to an active P2P server room.',
        profile,
      };
    }

    const stake = Math.floor(Number(params.stakePoints) || 0);
    if (stake < 0) {
      return { ok: false, error: 'Point bet must be 0 or greater.', profile };
    }
    if (stake > profile.points) {
      return {
        ok: false,
        error: `Insufficient points (you have ${profile.points} pts available).`,
        profile,
      };
    }

    profile.activeP2PPointBet = stake;
    profile.activeP2PRoomId = params.roomId;
    profile.updatedAt = Date.now();
    this.save();
    return { ok: true, profile };
  }

  public registerUploadedRom(params: {
    playerId: string;
    handle: string;
    fingerprint: string;
    rom: CustomUploadedRom;
  }): PlayerLedgerProfile {
    const profile = this.getOrCreateProfile(params.playerId, params.handle, params.fingerprint);
    const filtered = profile.uploadedRoms.filter((r) => r.romKey !== params.rom.romKey);
    profile.uploadedRoms = [params.rom, ...filtered].slice(0, 24);
    profile.updatedAt = Date.now();
    this.save();
    return profile;
  }

  public commitGameBlock(params: {
    playerId: string;
    handle: string;
    fingerprint: string;
    gameType: string;
    summary: string;
    chipsDelta: number;
    outcome?: 'win' | 'loss' | 'draw' | 'save';
    isP2PServerRoom?: boolean;
    p2pPointWager?: number;
    statePayload: Record<string, unknown>;
  }): { block: LedgerBlock; profile: PlayerLedgerProfile; pointsDelta: number; dailyPointAwarded: boolean } {
    const profile = this.getOrCreateProfile(params.playerId, params.handle, params.fingerprint);
    profile.chips = Math.max(100, profile.chips + params.chipsDelta);

    let pointsDelta = 0;
    let dailyPointAwarded = false;
    const isP2P = Boolean(params.isP2PServerRoom ?? true);
    const activeWager = isP2P
      ? Math.min(profile.points, Math.max(0, Math.floor(Number(params.p2pPointWager ?? profile.activeP2PPointBet) || 0)))
      : 0;

    if (params.outcome === 'win') {
      profile.wins += 1;
      profile.gamesPlayed += 1;
      profile.eloRating += 18;

      // 1 point per game won per day, up to 50 max
      if (profile.dailyPointsEarned < DAILY_POINT_CAP) {
        profile.dailyPointsEarned += 1;
        profile.points += 1;
        pointsDelta += 1;
        dailyPointAwarded = true;
      }

      // Settle P2P-only point bet if active
      if (isP2P && activeWager > 0) {
        profile.points += activeWager;
        pointsDelta += activeWager;
      }
      profile.activeP2PPointBet = 0;
    } else if (params.outcome === 'loss') {
      profile.losses += 1;
      profile.gamesPlayed += 1;
      profile.eloRating = Math.max(800, profile.eloRating - 14);

      if (isP2P && activeWager > 0) {
        profile.points = Math.max(0, profile.points - activeWager);
        pointsDelta -= activeWager;
      }
      profile.activeP2PPointBet = 0;
    } else if (params.outcome === 'draw') {
      profile.gamesPlayed += 1;
      profile.activeP2PPointBet = 0;
    }

    if (params.statePayload && typeof params.statePayload.romSlot === 'string') {
      profile.savedRomStates[params.statePayload.romSlot] = {
        romId: Number(params.statePayload.romId || 1),
        score: Number(params.statePayload.score || 0),
        lives: Number(params.statePayload.lives || 3),
        hexDump: String(params.statePayload.hexDump || ''),
        updatedAt: Date.now(),
      };
    }

    profile.updatedAt = Date.now();

    const prevBlock = this.data.blocks[this.data.blocks.length - 1];
    const index = prevBlock.index + 1;
    const timestamp = Date.now();
    const vectorClock = prevBlock.vectorClock + 1;
    const encryptedState = encryptPacket(params.statePayload);
    const blockHash = sha256Hex(
      `${index}:${prevBlock.blockHash}:${timestamp}:${params.playerId}:${params.gameType}:${params.chipsDelta}:${pointsDelta}:${encryptedState.cipherText}`
    );

    const newBlock: LedgerBlock = {
      index,
      blockHash,
      prevHash: prevBlock.blockHash,
      timestamp,
      playerId: params.playerId,
      handle: profile.handle,
      gameType: params.gameType,
      vectorClock,
      summary: params.summary,
      chipsDelta: params.chipsDelta,
      pointsDelta,
      pointsAfter: profile.points,
      bankrollAfter: profile.chips,
      encryptedState,
    };

    this.data.blocks.push(newBlock);
    if (this.data.blocks.length > 100) {
      this.data.blocks = this.data.blocks.slice(-100);
    }
    this.save();
    return { block: newBlock, profile, pointsDelta, dailyPointAwarded };
  }

  public getRecentBlocks(limit = 25): LedgerBlock[] {
    return this.data.blocks.slice(-limit).reverse();
  }

  public getLeaderboard(): PlayerLedgerProfile[] {
    return Object.values(this.data.profiles).sort(
      (a, b) => (b.points || 0) - (a.points || 0) || b.wins - a.wins || b.chips - a.chips
    );
  }
}

export const ledger = new StateLedger();
