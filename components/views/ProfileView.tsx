import React, { useState } from 'react';
import { nativeBridge } from '../../app/nativeBindings.ts';
import { pollConnectedGamepads, triggerGamepadHaptics } from '../../app/peripheralManager.ts';
import { MinimizableEscrowBar } from '../framework/MinimizableEscrowBar.tsx';

interface LedgerBlockItem {
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
}

interface LeaderboardEntry {
  playerId: string;
  handle: string;
  publicKeyFingerprint: string;
  points: number;
  dailyPointsEarned: number;
  wins: number;
  losses: number;
  chips: number;
  eloRating: number;
}

interface MeshPeerItem {
  peerId: string;
  handle: string;
  roomId: string;
  activeGame: string;
  fingerprint: string;
  latencyMs: number;
}

interface ProfileViewProps {
  playerId: string;
  handle: string;
  fingerprint: string;
  sessionToken: string;
  bankroll: number;
  points: number;
  dailyPointsEarned: number;
  activeP2PPointBet: number;
  isP2PConnected: boolean;
  eloRating: number;
  wins: number;
  losses: number;
  leaderboard: LeaderboardEntry[];
  ledgerBlocks: LedgerBlockItem[];
  peers: MeshPeerItem[];
  onPlaceP2PPointBet: (stake: number) => void;
  onUpdateIdentity: (newHandle: string) => void;
  onJoinMeshRoom: (roomId: string, gameType: string) => void;
  onSendMeshChat: (text: string) => void;
  chatMessages: Array<{ id: string; senderHandle: string; text: string; cipherDigest: string; timestamp: number }>;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  playerId,
  handle,
  fingerprint,
  sessionToken,
  bankroll,
  points,
  dailyPointsEarned,
  activeP2PPointBet,
  isP2PConnected,
  eloRating,
  wins,
  losses,
  leaderboard,
  ledgerBlocks,
  peers,
  onPlaceP2PPointBet,
  onUpdateIdentity,
  onJoinMeshRoom,
  onSendMeshChat,
  chatMessages,
}) => {
  const [handleInput, setHandleInput] = useState(handle);
  const [chatInput, setChatInput] = useState('');
  const [customStakeInput, setCustomStakeInput] = useState<string>(String(activeP2PPointBet || 1));

  // Lyria 3 Soundtrack Generator Studio state
  const [musicPrompt, setMusicPrompt] = useState(
    'Atmospheric retro synthwave and velvet casino lounge soundtrack with warm analog bass'
  );
  const [musicDurationMode, setMusicDurationMode] = useState<'clip' | 'full'>('clip');
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [generatedLyrics, setGeneratedLyrics] = useState<string>('');
  const [musicStatus, setMusicStatus] = useState<string>(
    'Select Lyria Clip (30s) or Lyria Pro (full track) to synthesize custom game music, or toggle the procedural Web Audio synth.'
  );
  const [synthActive, setSynthActive] = useState<boolean>(nativeBridge.isSoundtrackPlaying());

  // AES-256-GCM Packet Test Console
  const [testPayload, setTestPayload] = useState('{"action":"bet_points","points":5,"room":"main-holdem-1"}');
  const [sealedResult, setSealedResult] = useState<{ cipherText: string; iv: string; authTag: string } | null>(null);

  const handleGenerateMusic = async () => {
    setIsGeneratingMusic(true);
    setMusicStatus(
      `Requesting ${musicDurationMode === 'full' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview'} audio stream...`
    );
    try {
      const res = await fetch('/api/ai/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: musicPrompt, durationMode: musicDurationMode }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        nativeBridge.startProceduralSoundtrack();
        setSynthActive(true);
        setMusicStatus(
          `${data.error || 'Lyria requires a billing-enabled API key.'} Activated live procedural Web Audio Dorian soundtrack.`
        );
      } else {
        setGeneratedAudioUrl(data.audioDataUrl);
        setGeneratedLyrics(data.lyrics || '');
        setMusicStatus(`Synthesized track with ${data.model}. Ready for playback below.`);
        nativeBridge.playSfx('victory');
      }
    } catch {
      nativeBridge.startProceduralSoundtrack();
      setSynthActive(true);
      setMusicStatus('Offline mode: Activated zero-latency Web Audio procedural soundtrack.');
    } finally {
      setIsGeneratingMusic(false);
    }
  };

  const toggleProceduralSynth = () => {
    if (nativeBridge.isSoundtrackPlaying()) {
      nativeBridge.stopProceduralSoundtrack();
      setSynthActive(false);
    } else {
      nativeBridge.startProceduralSoundtrack();
      setSynthActive(true);
    }
  };

  const testAesSeal = async () => {
    try {
      const res = await fetch('/api/crypto/seal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: testPayload }),
      });
      const data = await res.json();
      if (data.envelope) {
        setSealedResult(data.envelope);
        nativeBridge.playSfx('chip');
      }
    } catch {
      // ignore
    }
  };

  const gamepads = pollConnectedGamepads();

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-yellow-500/25">
        <div>
          <h1 className="text-2xl font-bold text-yellow-400 font-display">
            04. P2P Leaderboard, Minimizable Point Escrow &amp; Cryptographic Ledger
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-neutral-200 mt-1 font-mono tabular-nums">
            <span className="text-yellow-400 font-bold">Total Points: {points}</span>
            <span aria-hidden="true">·</span>
            <span className="text-yellow-200 font-semibold">Daily Win Points: {dailyPointsEarned} / 50 Max</span>
            <span aria-hidden="true">·</span>
            <span>Record: {wins}W - {losses}L</span>
          </div>
        </div>
      </div>

      {/* Reusable Minimizable P2P Point Wager Escrow Bar */}
      <MinimizableEscrowBar
        points={points}
        dailyPointsEarned={dailyPointsEarned}
        isP2PConnected={isP2PConnected}
        activeP2PPointBet={activeP2PPointBet}
        onPlaceP2PPointBet={onPlaceP2PPointBet}
        arenaLabel="Global P2P Mesh Point Wager Escrow"
      />

      {/* Top Section: Simple Leaderboard + Daily Points & P2P-Only Point Betting */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Simple Leaderboard Table */}
        <div className="lg:col-span-7 bg-[#0B0A07] border border-yellow-500/35 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-yellow-300 font-display">Simple P2P Leaderboard</h2>
              <p className="text-xs sm:text-sm text-neutral-300">
                Players earn 1 point per game won per day (up to 50 points/day max).
              </p>
            </div>
            <span className="text-xs font-mono text-yellow-400 font-bold tabular-nums">
              Your Daily Cap: {dailyPointsEarned} / 50 Pts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm font-mono tabular-nums">
              <thead>
                <tr className="border-b border-yellow-500/25 text-yellow-300/90">
                  <th className="py-2.5 pr-3">RANK</th>
                  <th className="py-2.5 pr-3">PLAYER</th>
                  <th className="py-2.5 pr-3 text-right">POINTS</th>
                  <th className="py-2.5 pr-3 text-right">TODAY (≤50)</th>
                  <th className="py-2.5 pr-3 text-right">WINS</th>
                  <th className="py-2.5 text-right">CHIPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-yellow-500/15">
                {leaderboard.map((entry, idx) => {
                  const isSelf = entry.playerId === playerId;
                  return (
                    <tr
                      key={entry.playerId}
                      className={isSelf ? 'bg-yellow-500/15 text-yellow-100' : 'hover:bg-[#14120B]'}
                    >
                      <td className="py-2.5 pr-3 font-bold text-yellow-400">#{idx + 1}</td>
                      <td className="py-2.5 pr-3 font-sans font-bold text-yellow-50">
                        {entry.handle} {isSelf ? '(You)' : ''}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-bold text-yellow-400">{entry.points ?? 0} Pts</td>
                      <td className="py-2.5 pr-3 text-right text-yellow-200">
                        {entry.dailyPointsEarned ?? 0} / 50
                      </td>
                      <td className="py-2.5 pr-3 text-right text-neutral-200">{entry.wins}</td>
                      <td className="py-2.5 text-right text-neutral-300">{entry.chips.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* P2P-Only Point Betting Escrow & Daily Progress Card */}
        <div className="lg:col-span-5 bg-[#0B0A07] border border-yellow-500/35 rounded-2xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <h2 className="text-base font-bold text-yellow-300 font-display">
              Daily Win Points &amp; Custom P2P Stake
            </h2>
            <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed">
              Every victory in Card Games, Board Games, or Emulator challenges awards <strong className="text-yellow-300">+1 Point</strong> (up to{' '}
              <strong className="text-yellow-300">50 points per day</strong>). Earned points can be wagered <strong className="text-yellow-300">only on active P2P servers</strong>.
            </p>

            {/* Daily 50-Point Progress Bar */}
            <div className="p-4 bg-[#12110B] border border-yellow-500/25 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-neutral-300">DAILY POINT QUOTA</span>
                <span className="text-yellow-400 font-bold">{dailyPointsEarned} / 50 PTS</span>
              </div>
              <div className="w-full h-2.5 bg-[#070705] rounded-full overflow-hidden border border-yellow-500/20">
                <div
                  style={{ width: `${Math.min(100, (dailyPointsEarned / 50) * 100)}%` }}
                  className="h-full bg-yellow-400 transition-all"
                />
              </div>
            </div>

            {/* P2P Server Point Wager Box */}
            <div className="p-4 bg-[#12110B] border border-yellow-500/35 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-yellow-300 font-bold">CUSTOM P2P ESCROW STAKE</span>
                <span className={isP2PConnected ? 'text-yellow-400 font-bold' : 'text-amber-500'}>
                  {isP2PConnected ? 'P2P SERVER CONNECTED' : 'OFFLINE (P2P REQUIRED)'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={points}
                  value={customStakeInput}
                  onChange={(e) => setCustomStakeInput(e.target.value)}
                  disabled={!isP2PConnected}
                  className="w-24 px-3 py-1.5 text-xs font-mono bg-[#080806] border border-yellow-500/35 rounded-lg text-yellow-100"
                />
                <button
                  type="button"
                  disabled={!isP2PConnected}
                  onClick={() => {
                    const val = Math.max(0, Math.min(points, Number(customStakeInput) || 0));
                    onPlaceP2PPointBet(val);
                  }}
                  className="px-4 py-1.5 text-xs font-bold text-black bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 rounded-lg cursor-pointer"
                >
                  Lock P2P Point Bet
                </button>
                {activeP2PPointBet > 0 && (
                  <button
                    type="button"
                    onClick={() => onPlaceP2PPointBet(0)}
                    className="px-3 py-1.5 text-xs bg-[#18160E] hover:bg-[#242114] text-yellow-200 border border-yellow-500/30 rounded-lg cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="text-xs font-mono text-neutral-300">
                Active P2P Point Bet: <strong className="text-yellow-400">{activeP2PPointBet} Pts</strong> · Available Balance:{' '}
                <strong className="text-yellow-100">{points} Pts</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row: Cryptographic Identity + Lyria 3 Soundtrack Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-6 bg-[#0B0A07] border border-yellow-500/35 rounded-2xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <h2 className="text-base font-bold text-yellow-300 font-display">
              Decentralized Player Keypair &amp; Auth
            </h2>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                maxLength={28}
                className="flex-1 px-3.5 py-2 text-sm bg-[#12110B] border border-yellow-500/30 rounded-xl text-yellow-50"
                placeholder="Enter Peer Handle"
              />
              <button
                type="button"
                onClick={() => {
                  onUpdateIdentity(handleInput);
                  nativeBridge.playSfx('victory');
                }}
                className="px-4 py-2 text-xs font-bold text-black bg-yellow-400 hover:bg-yellow-300 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Rotate Signed Keypair
              </button>
            </div>

            <div className="p-3.5 bg-[#12110B] border border-yellow-500/25 rounded-xl font-mono text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">PUBLIC KEY FINGERPRINT</span>
                <span className="text-yellow-400 font-bold">{fingerprint}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">BANKROLL LEDGER</span>
                <span className="text-yellow-200 font-bold tabular-nums">{bankroll.toLocaleString()} Chips</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">COMPETITIVE ELO</span>
                <span className="text-yellow-100 tabular-nums">{eloRating}</span>
              </div>
              <div className="pt-1 text-[11px] text-neutral-400 truncate">
                Token: {sessionToken || 'local_signed_ecdsa_session'}
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-3 border-t border-yellow-500/20">
            <div className="text-xs font-bold text-yellow-300">AES-256-GCM P2P Packet Encryption Verifier</div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={testPayload}
                onChange={(e) => setTestPayload(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs font-mono bg-[#12110B] border border-yellow-500/30 rounded-lg text-yellow-100"
              />
              <button
                type="button"
                onClick={testAesSeal}
                className="px-3.5 py-1.5 text-xs font-bold bg-yellow-400 hover:bg-yellow-300 text-black rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                Seal Packet
              </button>
            </div>
            {sealedResult && (
              <div className="p-2.5 bg-[#12110B] border border-yellow-500/25 rounded-lg font-mono text-xs text-neutral-300 space-y-0.5">
                <div>
                  IV: <span className="text-yellow-100">{sealedResult.iv}</span> · Tag:{' '}
                  <span className="text-yellow-400">{sealedResult.authTag}</span>
                </div>
                <div className="truncate">
                  Cipher: <span className="text-yellow-300">{sealedResult.cipherText}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-6 bg-[#0B0A07] border border-yellow-500/35 rounded-2xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-yellow-300 font-display">Lyria 3 AI Soundtrack Studio</h2>
              <div className="flex items-center gap-1 bg-[#12110B] p-1 rounded-lg border border-yellow-500/30">
                <button
                  type="button"
                  onClick={() => setMusicDurationMode('clip')}
                  className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
                    musicDurationMode === 'clip'
                      ? 'bg-yellow-400 text-black font-bold'
                      : 'text-neutral-300 hover:text-yellow-200'
                  }`}
                >
                  Lyria Clip (30s)
                </button>
                <button
                  type="button"
                  onClick={() => setMusicDurationMode('full')}
                  className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
                    musicDurationMode === 'full'
                      ? 'bg-yellow-400 text-black font-bold'
                      : 'text-neutral-300 hover:text-yellow-200'
                  }`}
                >
                  Lyria Pro (Full)
                </button>
              </div>
            </div>

            <textarea
              value={musicPrompt}
              onChange={(e) => setMusicPrompt(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-[#12110B] border border-yellow-500/30 rounded-xl text-yellow-50 resize-none"
              placeholder="Describe your custom arcade or card room soundtrack..."
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isGeneratingMusic}
                onClick={handleGenerateMusic}
                className="px-4 py-2 text-xs font-bold text-black bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isGeneratingMusic
                  ? 'Synthesizing with Lyria 3...'
                  : `Generate Track (${musicDurationMode === 'full' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview'})`}
              </button>

              <button
                type="button"
                onClick={toggleProceduralSynth}
                className={`px-4 py-2 text-xs font-bold rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  synthActive
                    ? 'bg-amber-400 text-black border-amber-200'
                    : 'bg-[#16150E] text-yellow-200 border-yellow-500/35 hover:bg-[#242114]'
                }`}
              >
                {synthActive ? 'Stop WebAudio Dorian Synth' : 'Play Procedural Synth Loop'}
              </button>
            </div>

            <div className="text-xs sm:text-sm text-neutral-300">{musicStatus}</div>

            {generatedAudioUrl && (
              <div className="p-3 bg-[#12110B] border border-yellow-500/25 rounded-xl space-y-2">
                <audio controls src={generatedAudioUrl} className="w-full h-9" />
                {generatedLyrics && (
                  <div className="text-xs text-neutral-300 font-mono max-h-20 overflow-y-auto">
                    {generatedLyrics}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-yellow-500/20 flex items-center justify-between text-xs">
            <span className="font-semibold text-neutral-200">
              Connected Bluetooth / SDL Gamepads ({gamepads.length})
            </span>
            <button
              type="button"
              onClick={() => {
                triggerGamepadHaptics(0.8, 120);
                nativeBridge.playSfx('powerup');
              }}
              className="px-3 py-1.5 text-xs font-mono font-bold bg-[#16150E] hover:bg-yellow-400 hover:text-black text-yellow-300 border border-yellow-500/35 rounded-lg cursor-pointer transition-colors"
            >
              Test Controller Haptic Pulse
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: P2P Mesh Lobby + Immutable Hash-Chained Save Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 bg-[#0B0A07] border border-yellow-500/35 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-yellow-300 font-display">
            P2P Mesh Topology &amp; Gossip Channel
          </h2>
          <div className="space-y-2">
            {peers.map((p) => (
              <div
                key={p.peerId}
                className="flex items-center justify-between p-3 bg-[#12110B] border border-yellow-500/25 rounded-xl text-xs"
              >
                <div>
                  <div className="font-bold text-yellow-100">{p.handle}</div>
                  <div className="font-mono text-[11px] text-neutral-400">
                    {p.fingerprint} · Room: {p.roomId}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onJoinMeshRoom(p.roomId, p.activeGame);
                    nativeBridge.playSfx('move');
                  }}
                  className="px-3 py-1.5 text-xs font-mono font-bold bg-yellow-400 hover:bg-yellow-300 text-black rounded-lg cursor-pointer"
                >
                  Sync ({p.latencyMs}ms)
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2 border-t border-yellow-500/20">
            <div className="h-36 overflow-y-auto bg-[#12110B] border border-yellow-500/25 rounded-xl p-3 space-y-2 text-xs">
              {chatMessages.length === 0 ? (
                <div className="text-neutral-400 font-mono">Encrypted P2P gossip log ready...</div>
              ) : (
                chatMessages.map((m) => (
                  <div key={m.id} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-yellow-400">{m.senderHandle}</span>
                      <span className="font-mono text-neutral-400">GCM:{m.cipherDigest}</span>
                    </div>
                    <div className="text-yellow-50">{m.text}</div>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && chatInput.trim()) {
                    onSendMeshChat(chatInput);
                    setChatInput('');
                  }
                }}
                placeholder="Broadcast AES-GCM message to room peers..."
                className="flex-1 px-3 py-2 text-xs bg-[#12110B] border border-yellow-500/30 rounded-xl text-yellow-50"
              />
              <button
                type="button"
                onClick={() => {
                  if (chatInput.trim()) {
                    onSendMeshChat(chatInput);
                    setChatInput('');
                  }
                }}
                className="px-3.5 py-2 text-xs font-bold text-black bg-yellow-400 hover:bg-yellow-300 rounded-xl cursor-pointer"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Immutable Hash-Chained State Ledger */}
        <div className="lg:col-span-7 bg-[#0B0A07] border border-yellow-500/35 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-yellow-300 font-display">
              Immutable SHA-256 Save &amp; Match Ledger
            </h2>
            <span className="text-xs font-mono text-yellow-400 tabular-nums">
              {ledgerBlocks.length} Signed Blocks
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm font-mono tabular-nums">
              <thead>
                <tr className="border-b border-yellow-500/25 text-yellow-300/90">
                  <th className="py-2 pr-3">BLK</th>
                  <th className="py-2 pr-3">GAME</th>
                  <th className="py-2 pr-3">SUMMARY</th>
                  <th className="py-2 pr-3 text-right">PTS</th>
                  <th className="py-2 pr-3 text-right">CHIPS</th>
                  <th className="py-2 text-right">SHA-256 HASH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-yellow-500/15">
                {ledgerBlocks.map((b) => (
                  <tr key={b.blockHash} className="hover:bg-[#14120B]">
                    <td className="py-2.5 pr-3 text-neutral-400">#{b.index}</td>
                    <td className="py-2.5 pr-3 text-yellow-400 font-bold">{b.gameType}</td>
                    <td className="py-2.5 pr-3 text-yellow-50 font-sans">{b.summary}</td>
                    <td className="py-2.5 pr-3 text-right font-bold text-yellow-300">
                      {(b.pointsDelta ?? 0) > 0 ? `+${b.pointsDelta}` : b.pointsDelta ?? 0}
                    </td>
                    <td
                      className={`py-2.5 pr-3 text-right font-bold ${
                        b.chipsDelta > 0
                          ? 'text-yellow-400'
                          : b.chipsDelta < 0
                          ? 'text-amber-500'
                          : 'text-neutral-400'
                      }`}
                    >
                      {b.chipsDelta > 0 ? `+${b.chipsDelta}` : b.chipsDelta}
                    </td>
                    <td className="py-2.5 text-right text-neutral-400">{b.blockHash.slice(0, 10)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
