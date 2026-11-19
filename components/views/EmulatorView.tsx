import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { WasmMemoryArena } from '../../web/wasmMemory.ts';
import { GPUComputePipeline } from '../../web/gpuCompute.ts';
import {
  PhaserWasmEmulator,
  ROM_CATALOG,
  RomCatalogItem,
  RomId,
  EmulatorMatchResult,
} from '../../web/phaserEmulator.ts';
import { EmulatorRuntimeFramework, CustomRomMetadata } from '../../web/emulatorFramework.ts';
import { VirtualDPadOverlay, useUnifiedInput } from '../InputMapper.tsx';
import { nativeBridge } from '../../app/nativeBindings.ts';
import { MinimizableTutorial } from '../framework/MinimizableTutorial.tsx';
import { GameWinMenuModal, GameWinMenuPayload } from '../framework/GameWinMenuModal.tsx';
import { Upload, Search, Cpu, Disc, RotateCcw, Trophy } from 'lucide-react';

export interface UploadedRomRecord {
  romKey: string;
  title: string;
  system: string;
  genre: string;
  year: number;
  baseRomId: number;
  speedScale: number;
  lives: number;
  hexDump?: string;
}

export interface EmulatorViewProps {
  onCommitSaveState?: (params: {
    gameType: string;
    summary: string;
    chipsDelta: number;
    outcome: 'win' | 'loss' | 'draw' | 'save';
    statePayload: Record<string, unknown>;
  }) => void | Promise<void>;
  onUploadCustomRom?: (rom: UploadedRomRecord) => void | Promise<void>;
  uploadedRoms?: UploadedRomRecord[];
  savedRomStates?: Record<
    string,
    { romId: number; score: number; lives: number; hexDump: string; updatedAt: number }
  >;
}

export const EmulatorView: React.FC<EmulatorViewProps> = ({
  onCommitSaveState,
  onUploadCustomRom,
  uploadedRoms: propUploadedRoms = [],
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<PhaserWasmEmulator | null>(null);
  const memoryRef = useRef<WasmMemoryArena | null>(null);
  const gpuRef = useRef<GPUComputePipeline | null>(null);

  const [selectedRom, setSelectedRom] = useState<RomCatalogItem>(ROM_CATALOG[2]); // Default Asteroid Vector DX
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [genreFilter, setGenreFilter] = useState<string>('All');
  const [localUploadedRoms, setLocalUploadedRoms] = useState<RomCatalogItem[]>([]);
  const [customRomMeta, setCustomRomMeta] = useState<Record<string, CustomRomMetadata>>({});
  const [liveScore, setLiveScore] = useState<number>(0);
  const [liveWave, setLiveWave] = useState<number>(1);
  const [liveLives, setLiveLives] = useState<number>(3);
  const [hexDump, setHexDump] = useState<string[]>([]);
  const [winMenuPayload, setWinMenuPayload] = useState<GameWinMenuPayload | null>(null);

  const hwProfile = useMemo(() => EmulatorRuntimeFramework.detectHardwareCapabilities(), []);

  const handleActionKey = useCallback((code: string, isDown: boolean) => {
    engineRef.current?.setKeyState(code, isDown);
  }, []);

  const { gamepads, lastInputSource } = useUnifiedInput(handleActionKey);

  const commitRomOutcome = useCallback(
    (romTitle: string, score: number, wave: number, outcome: 'win' | 'loss' | 'save') => {
      const chipsDelta = outcome === 'win' ? Math.max(120, score) : Math.max(50, Math.floor(score / 2));
      onCommitSaveState?.({
        gameType: `Emulator:${romTitle}`,
        summary: `${romTitle} — Score ${score} at Wave ${wave}`,
        chipsDelta,
        outcome: outcome === 'loss' ? 'save' : outcome,
        statePayload: {
          romTitle,
          score,
          wave,
          hexDump: memoryRef.current?.exportHexSnapshot(64) || '',
        },
      });
    },
    [onCommitSaveState]
  );

  const handleEmulatorMatchEnd = useCallback(
    (result: EmulatorMatchResult) => {
      const chipBonus = Math.max(100, result.score);
      if (result.score > 0) {
        commitRomOutcome(result.romTitle, result.score, result.wave, result.outcome);
      }
      setWinMenuPayload({
        gameId: result.romId,
        gameTitle: result.romTitle,
        outcome: result.outcome === 'win' ? 'win' : 'completed',
        headline:
          result.outcome === 'win'
            ? `${result.romTitle} — Wave ${result.wave} Cleared!`
            : `${result.romTitle} — Arcade Run Complete`,
        subheadline:
          result.outcome === 'win'
            ? `Outstanding vector piloting! You cleared Wave ${result.wave - 1} with ${result.score} points.`
            : `Run finished at Wave ${result.wave} with ${result.score} points logged to the Wasm state ledger.`,
        stats: [
          { label: 'ROM Cartridge', value: result.romTitle },
          { label: 'Final Score', value: `${result.score} Pts` },
          { label: 'Wave Reached', value: `Wave ${result.wave}` },
        ],
        chipsDelta: result.score > 0 ? chipBonus : 0,
        dailyPointAwarded: result.score > 0,
        dailyPointsEarned: 1,
      });
    },
    [commitRomOutcome]
  );

  const matchEndRef = useRef(handleEmulatorMatchEnd);
  matchEndRef.current = handleEmulatorMatchEnd;

  useEffect(() => {
    if (!canvasRef.current) return;
    const { memory, gpu } = EmulatorRuntimeFramework.createMemoryAndGpuContext();
    const emulator = new PhaserWasmEmulator(
      canvasRef.current,
      memory,
      gpu,
      (res) => matchEndRef.current(res)
    );
    emulator.start();

    memoryRef.current = memory;
    gpuRef.current = gpu;
    engineRef.current = emulator;

    const timer = window.setInterval(() => {
      const sc = memory.getScore();
      const wv = memory.getWave();
      const lv = memory.getLives();
      setLiveScore(sc);
      setLiveWave(wv);
      setLiveLives(lv);
      setHexDump(memory.getHexSnapshot(4));
    }, 200);

    return () => {
      clearInterval(timer);
      emulator.stop();
    };
  }, []);

  const bootCatalogGame = (game: RomCatalogItem, e?: React.MouseEvent<HTMLButtonElement>) => {
    // Blur button immediately so pressing Spacebar to shoot in Asteroid never clicks this button!
    e?.currentTarget.blur();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setSelectedRom(game);
    setWinMenuPayload(null);
    engineRef.current?.loadRom(game.id, game.title);
    nativeBridge.playSfx('card');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      const meta = EmulatorRuntimeFramework.parseUploadedRom(file.name, buffer);

      const customItem: RomCatalogItem = {
        id: meta.mappedBaseRom,
        title: `${meta.title} [ROM-${meta.checksumHex.slice(0, 4)}]`,
        year: 2026,
        genre: 'Arcade',
        system: 'User-Uploaded-ROM',
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
        description: `Uploaded binary (${file.name}, ${file.size.toLocaleString()} bytes · Checksum 0x${meta.checksumHex}).`,
      };

      setCustomRomMeta((prev) => ({ ...prev, [customItem.title]: meta }));
      setLocalUploadedRoms((prev) => [customItem, ...prev]);
      onUploadCustomRom?.({
        romKey: meta.id,
        title: customItem.title,
        system: customItem.system,
        genre: customItem.genre,
        year: customItem.year,
        baseRomId: 1,
        speedScale: 100,
        lives: 3,
      });
      bootCatalogGame(customItem);
    };
    reader.readAsArrayBuffer(file);
  };

  const combinedUploadedCatalog = useMemo(() => {
    const mappedProps: RomCatalogItem[] = propUploadedRoms.map((u) => ({
      id: 'asteroid_blaster' as RomId,
      title: u.title,
      year: u.year || 2026,
      genre: 'Arcade',
      system: u.system || 'User-Uploaded-ROM',
      sizeKb: 32,
      description: `Saved user ROM (${u.romKey}) synced in Sovereign profile.`,
    }));
    return [...localUploadedRoms, ...mappedProps];
  }, [localUploadedRoms, propUploadedRoms]);

  const filteredCatalog = useMemo(
    () => EmulatorRuntimeFramework.searchCatalog(searchQuery, genreFilter, combinedUploadedCatalog),
    [searchQuery, genreFilter, combinedUploadedCatalog]
  );

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-yellow-500/25">
        <div>
          <h1 className="text-2xl font-bold text-yellow-400 font-display">
            03. Retro ROM Vault &amp; Wasm Vector Emulator
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-neutral-200 mt-1 font-mono tabular-nums">
            <span className="text-yellow-300 font-bold">Active ROM: {selectedRom.title}</span>
            <span aria-hidden="true">·</span>
            <span>Input: {lastInputSource}</span>
            <span aria-hidden="true">·</span>
            <span>Compute: {hwProfile.preferredComputeBackend}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold text-black bg-yellow-400 hover:bg-yellow-300 rounded-xl cursor-pointer transition-colors whitespace-nowrap shrink-0 shadow-[0_0_15px_rgba(250,204,21,0.25)]">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Local ROM (.nes/.gb/.wasm/.rom)</span>
            <input
              type="file"
              accept=".nes,.gb,.gbc,.rom,.wasm,.bin,.json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              commitRomOutcome(selectedRom.title, liveScore, liveWave, 'win');
              setWinMenuPayload({
                gameId: selectedRom.id,
                gameTitle: selectedRom.title,
                outcome: 'win',
                headline: `${selectedRom.title} — Score Committed!`,
                subheadline: `Committed ${liveScore} points at Wave ${liveWave} to the Sovereign Ledger.`,
                stats: [
                  { label: 'ROM Title', value: selectedRom.title },
                  { label: 'Score Banked', value: `${liveScore} Pts` },
                  { label: 'Wave Reached', value: `Wave ${liveWave}` },
                ],
                chipsDelta: Math.max(100, liveScore),
                dailyPointAwarded: true,
                dailyPointsEarned: 1,
              });
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold text-yellow-300 bg-[#14130C] hover:bg-yellow-400 hover:text-black border border-yellow-500/40 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Finish &amp; Open Win Menu ({liveScore} Pts)</span>
          </button>
        </div>
      </div>

      {/* Collapsible Emulator Tutorial */}
      <MinimizableTutorial gameId="emulator" defaultMinimized={true} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 Cols: Active Emulator Viewport & Virtual Controls */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl bg-[#0B0A07] border-2 border-yellow-500/40 p-4 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-yellow-500/20 text-xs font-mono">
              <div className="flex items-center gap-2 text-yellow-300">
                <Disc className="w-4 h-4 text-yellow-400" />
                <span className="font-bold">{selectedRom.title}</span>
                <span aria-hidden="true">·</span>
                <span className="text-neutral-300">{selectedRom.system}</span>
              </div>
              <div className="flex items-center gap-3 tabular-nums">
                <span className="text-yellow-400 font-bold">SCORE: {liveScore}</span>
                <span className="text-yellow-200">WAVE: {liveWave}</span>
                <span className="text-amber-400">LIVES: {liveLives}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    engineRef.current?.loadRom(selectedRom.id, selectedRom.title);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#18160E] hover:bg-yellow-400 hover:text-black text-yellow-200 rounded-lg border border-yellow-500/35 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset ROM</span>
                </button>
              </div>
            </div>

            <div
              onClick={() => {
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
              }}
              className="relative flex justify-center bg-[#050507] rounded-xl overflow-hidden border border-yellow-500/30"
            >
              <canvas
                ref={canvasRef}
                width={720}
                height={440}
                className="w-full max-w-[720px] aspect-[18/11] block cursor-crosshair"
              />
            </div>

            <VirtualDPadOverlay onActionKey={handleActionKey} />
          </div>

          {/* Wasm Linear Memory Inspector */}
          <div className="rounded-xl bg-[#0B0A07] border border-yellow-500/25 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-yellow-400">
              <span className="flex items-center gap-1.5 font-bold">
                <Cpu className="w-3.5 h-3.5" />
                <span>WASM LINEAR MEMORY BUFFER (64KB ARENA SNAPSHOT)</span>
              </span>
              <span className="text-neutral-300">
                Gamepads: {gamepads.length > 0 ? gamepads[0].id : 'Keyboard / Virtual D-Pad'}
              </span>
            </div>
            <div className="font-mono text-xs text-yellow-200/90 bg-[#060604] p-3 rounded-lg border border-yellow-500/20 space-y-1 overflow-x-auto">
              {hexDump.map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Searchable Retro ROM Library */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl bg-[#0B0A07] border border-yellow-500/35 p-5 space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-yellow-300 font-display">
                Searchable Retro ROM Library &amp; User Vault
              </h2>
              <p className="text-xs sm:text-sm text-neutral-300">
                Search built-in vector/arcade ROMs or load your own uploaded ROM images.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-yellow-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ROM title, system, or genre..."
                className="w-full pl-9 pr-3 py-2 bg-[#12110B] border border-yellow-500/30 rounded-xl text-xs sm:text-sm text-yellow-50 placeholder:text-neutral-400 focus:outline-none focus:border-yellow-400"
              />
            </div>

            {/* Genre Filter Bar */}
            <div className="flex flex-wrap gap-1.5">
              {['All', 'Vector', 'Arcade', 'Sports', 'Shooter', 'Tactical'].map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setGenreFilter(genre);
                  }}
                  className={`px-3 py-1 text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer ${
                    genreFilter === genre
                      ? 'bg-yellow-400 text-black'
                      : 'bg-[#14130D] text-neutral-300 hover:text-yellow-300 border border-yellow-500/20'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>

            {/* ROM List */}
            <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
              {filteredCatalog.map((rom, idx) => {
                const isLoaded = selectedRom.title === rom.title;
                const customMeta = customRomMeta[rom.title];
                return (
                  <div
                    key={`${rom.id}_${idx}`}
                    className={`p-3.5 rounded-xl border transition-colors ${
                      isLoaded
                        ? 'bg-[#181509] border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.12)]'
                        : 'bg-[#11100A] border-yellow-500/20 hover:border-yellow-500/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-yellow-100">{rom.title}</div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-yellow-400/80 font-mono mt-0.5">
                          <span>{rom.year}</span>
                          <span aria-hidden="true">·</span>
                          <span>{rom.genre}</span>
                          <span aria-hidden="true">·</span>
                          <span>{rom.system}</span>
                          <span aria-hidden="true">·</span>
                          <span>{rom.sizeKb} KB</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => bootCatalogGame(rom, e)}
                        className={`px-3.5 py-1.5 text-xs font-mono font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isLoaded
                            ? 'bg-yellow-400 text-black'
                            : 'bg-[#1B1910] hover:bg-yellow-400 hover:text-black text-yellow-200 border border-yellow-500/30'
                        }`}
                      >
                        {isLoaded ? 'Active ROM' : 'Load ROM'}
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm text-neutral-200 mt-2 leading-relaxed">
                      {rom.description}
                    </p>
                    {customMeta && (
                      <div className="mt-1.5 text-[11px] font-mono text-yellow-300/80">
                        CRC32/FNV Checksum: 0x{customMeta.checksumHex} · Base Engine: {customMeta.mappedBaseRom}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Per-Game Emulator Win / Match Complete Modal */}
      <GameWinMenuModal
        payload={winMenuPayload}
        onPlayAgain={() => {
          setWinMenuPayload(null);
          engineRef.current?.loadRom(selectedRom.id, selectedRom.title);
        }}
        onDismiss={() => setWinMenuPayload(null)}
        switchGameOptions={ROM_CATALOG.map((r) => ({ id: r.id, label: r.title }))}
        onSwitchGame={(romId) => {
          const found = ROM_CATALOG.find((r) => r.id === romId);
          if (found) bootCatalogGame(found);
        }}
      />
    </div>
  );
};
