/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TitleScreen } from '../components/TitleScreen.tsx';
import { TopNavigationHud, ActivePillarView } from '../components/HudOverlay.tsx';
import { CardGamesView } from '../components/views/CardGamesView.tsx';
import { BoardGamesView } from '../components/views/BoardGamesView.tsx';
import { EmulatorView } from '../components/views/EmulatorView.tsx';
import { ProfileView } from '../components/views/ProfileView.tsx';
import { nativeBridge } from '../app/nativeBindings.ts';
import { X } from 'lucide-react';

type ShellState = 'TITLE_MENU' | 'PLAYING';

export default function App() {
  const [shellState, setShellState] = useState<ShellState>('TITLE_MENU');
  const [activeView, setActiveView] = useState<ActivePillarView>('cards');
  const [isPausedModalOpen, setIsPausedModalOpen] = useState(false);

  // Cryptographic Identity, Daily Points & Ledger State
  const [playerId, setPlayerId] = useState('peer_aether01');
  const [handle, setHandle] = useState('Crimson Ace');
  const [fingerprint, setFingerprint] = useState('9F4E2C81B07D3A16');
  const [sessionToken, setSessionToken] = useState('');
  const [bankroll, setBankroll] = useState(5000);
  const [points, setPoints] = useState(12);
  const [dailyPointsEarned, setDailyPointsEarned] = useState(2);
  const [activeP2PPointBet, setActiveP2PPointBet] = useState(0);
  const [eloRating, setEloRating] = useState(1200);
  const [wins, setWins] = useState(2);
  const [losses, setLosses] = useState(0);
  const [savedRomStates, setSavedRomStates] = useState<
    Record<string, { romId: number; score: number; lives: number; hexDump: string; updatedAt: number }>
  >({});
  const [uploadedRoms, setUploadedRoms] = useState<
    Array<{
      romKey: string;
      title: string;
      system: string;
      genre: string;
      year: number;
      baseRomId: number;
      speedScale: number;
      lives: number;
      hexDump?: string;
    }>
  >([]);
  const [leaderboard, setLeaderboard] = useState<
    Array<{
      playerId: string;
      handle: string;
      publicKeyFingerprint: string;
      points: number;
      dailyPointsEarned: number;
      wins: number;
      losses: number;
      chips: number;
      eloRating: number;
    }>
  >([]);
  const [ledgerBlocks, setLedgerBlocks] = useState<
    Array<{
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
      pointsDelta?: number;
      pointsAfter?: number;
      bankrollAfter: number;
    }>
  >([]);

  // P2P Mesh WebSocket State
  const wsRef = useRef<WebSocket | null>(null);
  const [isP2PConnected, setIsP2PConnected] = useState<boolean>(true);
  const [peers, setPeers] = useState<
    Array<{
      peerId: string;
      handle: string;
      roomId: string;
      activeGame: string;
      fingerprint: string;
      latencyMs: number;
    }>
  >([]);
  const [remoteRoomState, setRemoteRoomState] = useState<Record<string, unknown>>({});
  const [chatMessages, setChatMessages] = useState<
    Array<{ id: string; senderHandle: string; text: string; cipherDigest: string; timestamp: number }>
  >([]);

  // Audio Mute State (Off by default)
  const [isMuted, setIsMuted] = useState(true);

  const syncProfileData = (profile: {
    chips: number;
    points?: number;
    dailyPointsEarned?: number;
    activeP2PPointBet?: number;
    eloRating: number;
    wins: number;
    losses: number;
    savedRomStates?: Record<string, { romId: number; score: number; lives: number; hexDump: string; updatedAt: number }>;
    uploadedRoms?: Array<{
      romKey: string;
      title: string;
      system: string;
      genre: string;
      year: number;
      baseRomId: number;
      speedScale: number;
      lives: number;
      hexDump?: string;
    }>;
  }) => {
    setBankroll(profile.chips);
    if (typeof profile.points === 'number') setPoints(profile.points);
    if (typeof profile.dailyPointsEarned === 'number') setDailyPointsEarned(profile.dailyPointsEarned);
    if (typeof profile.activeP2PPointBet === 'number') setActiveP2PPointBet(profile.activeP2PPointBet);
    setEloRating(profile.eloRating);
    setWins(profile.wins);
    setLosses(profile.losses);
    if (profile.savedRomStates) setSavedRomStates(profile.savedRomStates);
    if (profile.uploadedRoms) setUploadedRoms(profile.uploadedRoms);
  };

  // Bootstrap Cryptographic Identity & Ledger
  const initIdentityAndLedger = useCallback(
    async (requestedHandle?: string) => {
      try {
        const authRes = await fetch('/api/auth/identity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handle: requestedHandle || handle }),
        });
        const authData = await authRes.json();
        if (authData.identity) {
          setPlayerId(authData.identity.playerId);
          setHandle(authData.identity.handle);
          setFingerprint(authData.identity.publicKeyFingerprint);
          setSessionToken(authData.identity.sessionToken);
        }
        if (authData.profile) {
          syncProfileData(authData.profile);
        }

        const ledgerRes = await fetch(
          `/api/ledger?playerId=${encodeURIComponent(authData.identity?.playerId || playerId)}&handle=${encodeURIComponent(
            authData.identity?.handle || handle
          )}`
        );
        const ledgerData = await ledgerRes.json();
        if (ledgerData.profile) syncProfileData(ledgerData.profile);
        if (ledgerData.blocks) setLedgerBlocks(ledgerData.blocks);
        if (ledgerData.leaderboard) setLeaderboard(ledgerData.leaderboard);
        if (ledgerData.peers) setPeers(ledgerData.peers);
      } catch {
        // Offline resilient fallback
      }
    },
    [handle, playerId]
  );

  useEffect(() => {
    initIdentityAndLedger('Crimson Ace');
  }, []);

  // Connect P2P Mesh WebSocket Relay
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/mesh`;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const connect = () => {
      try {
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          setIsP2PConnected(true);
          socket?.send(
            JSON.stringify({
              type: 'peer:identify',
              payload: { peerId: playerId, handle, fingerprint, activeGame: activeView },
            })
          );
        };

        socket.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.type === 'mesh:init' || msg.type === 'mesh:presence') {
              if (msg.payload?.peers) setPeers(msg.payload.peers);
              if (msg.payload?.rooms?.[0]?.chatLog && chatMessages.length === 0) {
                setChatMessages(msg.payload.rooms[0].chatLog);
              }
            } else if (msg.type === 'game:state_updated') {
              if (msg.payload?.sharedState) {
                setRemoteRoomState(msg.payload.sharedState);
              }
            } else if (msg.type === 'room:chat_message' && msg.payload?.message) {
              setChatMessages((prev) => {
                if (prev.some((m) => m.id === msg.payload.message.id)) return prev;
                return [...prev, msg.payload.message];
              });
            }
          } catch {
            // ignore
          }
        };

        socket.onclose = () => {
          reconnectTimer = window.setTimeout(connect, 3500);
        };
      } catch {
        // ignore
      }
    };

    connect();
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [playerId, handle, fingerprint]);

  // Global Esc key for Pause / Title Shell Modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && shellState === 'PLAYING') {
        setIsPausedModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shellState]);

  const handlePlaceP2PPointBet = useCallback(
    async (stake: number) => {
      if (!isP2PConnected) return;
      const clamped = Math.max(0, Math.min(points, Math.floor(stake)));
      setActiveP2PPointBet(clamped);
      nativeBridge.playSfx('chip');
      try {
        const res = await fetch('/api/ledger/bet-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId,
            handle,
            fingerprint,
            roomId: 'main-holdem-1',
            isP2PServerConnected: isP2PConnected,
            stakePoints: clamped,
          }),
        });
        const data = await res.json();
        if (data.profile) syncProfileData(data.profile);
        if (data.leaderboard) setLeaderboard(data.leaderboard);
      } catch {
        // Offline resilient
      }
    },
    [isP2PConnected, points, playerId, handle, fingerprint]
  );

  const handleCommitResult = useCallback(
    async (params: {
      gameType: string;
      summary: string;
      chipsDelta: number;
      outcome: 'win' | 'loss' | 'draw' | 'save';
      statePayload: Record<string, unknown>;
    }) => {
      setBankroll((b) => Math.max(100, b + params.chipsDelta));
      if (params.outcome === 'win') {
        setWins((w) => w + 1);
        setEloRating((e) => e + 18);
        setDailyPointsEarned((d) => {
          if (d < 50) {
            setPoints((p) => p + 1 + (isP2PConnected ? activeP2PPointBet : 0));
            return d + 1;
          }
          setPoints((p) => p + (isP2PConnected ? activeP2PPointBet : 0));
          return d;
        });
        setActiveP2PPointBet(0);
      } else if (params.outcome === 'loss') {
        setLosses((l) => l + 1);
        setEloRating((e) => Math.max(800, e - 14));
        if (isP2PConnected && activeP2PPointBet > 0) {
          setPoints((p) => Math.max(0, p - activeP2PPointBet));
        }
        setActiveP2PPointBet(0);
      }

      try {
        const res = await fetch('/api/ledger/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId,
            handle,
            fingerprint,
            isP2PServerRoom: isP2PConnected,
            p2pPointWager: activeP2PPointBet,
            ...params,
          }),
        });
        const data = await res.json();
        if (data.profile) syncProfileData(data.profile);
        if (data.blocks) setLedgerBlocks(data.blocks);
        if (data.leaderboard) setLeaderboard(data.leaderboard);
      } catch {
        // Offline resilient
      }
    },
    [playerId, handle, fingerprint, isP2PConnected, activeP2PPointBet]
  );

  const handleUploadCustomRom = useCallback(
    async (rom: {
      romKey: string;
      title: string;
      system: string;
      genre: string;
      year: number;
      baseRomId: number;
      speedScale: number;
      lives: number;
      hexDump?: string;
    }) => {
      setUploadedRoms((prev) => [rom, ...prev.filter((r) => r.romKey !== rom.romKey)]);
      try {
        const res = await fetch('/api/emulator/upload-rom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, handle, fingerprint, rom }),
        });
        const data = await res.json();
        if (data.profile) syncProfileData(data.profile);
      } catch {
        // ignore
      }
    },
    [playerId, handle, fingerprint]
  );

  const handleSyncP2PState = useCallback((gameType: string, state: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'game:state_sync',
          payload: {
            roomId: 'main-holdem-1',
            gameType,
            state,
          },
        })
      );
    }
  }, []);

  const handleJoinMeshRoom = (roomId: string, gameType: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'room:join',
          payload: { roomId, gameType },
        })
      );
    }
  };

  const handleSendMeshChat = (text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'room:chat',
          payload: { roomId: 'main-holdem-1', text },
        })
      );
    } else {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `local_${Date.now()}`,
          senderHandle: handle,
          text,
          cipherDigest: 'LOCAL_AES_GCM',
          timestamp: Date.now(),
        },
      ]);
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    nativeBridge.setMuted(next);
  };

  if (shellState === 'TITLE_MENU') {
    return (
      <TitleScreen
        onEnterArena={(view) => {
          if (view) setActiveView(view);
          setShellState('PLAYING');
        }}
        peerCount={Math.max(2, peers.length)}
        playerHandle={handle}
        bankroll={bankroll}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#060606] text-yellow-50 flex flex-col">
      <TopNavigationHud
        activeView={activeView}
        onSelectView={(v) => setActiveView(v)}
        onOpenTitleShell={() => setShellState('TITLE_MENU')}
        bankroll={bankroll}
        points={points}
        dailyPointsEarned={dailyPointsEarned}
        peerCount={Math.max(2, peers.length)}
        isMuted={isMuted}
        onToggleMute={toggleMute}
      />

      <main className="flex-1">
        {activeView === 'cards' && (
          <CardGamesView
            bankroll={bankroll}
            points={points}
            dailyPointsEarned={dailyPointsEarned}
            isP2PConnected={isP2PConnected}
            activeP2PPointBet={activeP2PPointBet}
            onPlaceP2PPointBet={handlePlaceP2PPointBet}
            onCommitResult={handleCommitResult}
            onSyncP2PState={handleSyncP2PState}
            remoteRoomState={remoteRoomState}
          />
        )}

        {activeView === 'boards' && (
          <BoardGamesView
            points={points}
            dailyPointsEarned={dailyPointsEarned}
            isP2PConnected={isP2PConnected}
            activeP2PPointBet={activeP2PPointBet}
            onPlaceP2PPointBet={handlePlaceP2PPointBet}
            onCommitResult={handleCommitResult}
            onSyncP2PState={handleSyncP2PState}
          />
        )}

        {activeView === 'emulator' && (
          <EmulatorView
            onCommitSaveState={handleCommitResult}
            onUploadCustomRom={handleUploadCustomRom}
            uploadedRoms={uploadedRoms}
            savedRomStates={savedRomStates}
          />
        )}

        {activeView === 'profile' && (
          <ProfileView
            playerId={playerId}
            handle={handle}
            fingerprint={fingerprint}
            sessionToken={sessionToken}
            bankroll={bankroll}
            points={points}
            dailyPointsEarned={dailyPointsEarned}
            activeP2PPointBet={activeP2PPointBet}
            isP2PConnected={isP2PConnected}
            eloRating={eloRating}
            wins={wins}
            losses={losses}
            leaderboard={leaderboard}
            ledgerBlocks={ledgerBlocks}
            peers={peers}
            onPlaceP2PPointBet={handlePlaceP2PPointBet}
            onUpdateIdentity={(newHandle) => initIdentityAndLedger(newHandle)}
            onJoinMeshRoom={handleJoinMeshRoom}
            onSendMeshChat={handleSendMeshChat}
            chatMessages={chatMessages}
          />
        )}
      </main>

      {/* Pause / System Shell Modal (Esc) */}
      {isPausedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0E0E0E] border border-yellow-500/40 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-display text-yellow-400">Game Shell Paused</h2>
              <button
                type="button"
                onClick={() => setIsPausedModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-yellow-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-neutral-300">
              All P2P mesh sockets, Daily Point escrows, and Wasm linear memory registers remain preserved.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setIsPausedModalOpen(false)}
                className="w-full py-2.5 text-xs font-bold text-black bg-yellow-400 hover:bg-yellow-300 rounded-xl cursor-pointer"
              >
                Resume Match (Esc)
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPausedModalOpen(false);
                  setShellState('TITLE_MENU');
                }}
                className="w-full py-2.5 text-xs font-semibold text-yellow-200 bg-[#161616] hover:bg-[#222014] border border-yellow-500/30 rounded-xl cursor-pointer"
              >
                Return to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
