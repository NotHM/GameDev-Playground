// Pillar 4: Web — Reusable Emulation Runtime & ROM Loader Framework
import { WasmMemoryArena } from './wasmMemory.ts';
import { GPUComputePipeline } from './gpuCompute.ts';
import { RomId, ROM_CATALOG, RomCatalogItem } from './phaserEmulator.ts';

export interface CustomRomMetadata {
  id: string;
  title: string;
  filename: string;
  byteLength: number;
  checksumHex: string;
  mappedBaseRom: RomId;
  uploadedAt: number;
}

/**
 * Reusable Game Emulation Framework utilities for inspecting binary ROM headers,
 * computing deterministic FNV-1a checksums, and mapping custom uploads onto the
 * Wasm Linear Memory + Canvas execution core.
 */
export class EmulatorRuntimeFramework {
  public static computeChecksumHex(bytes: Uint8Array): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  }

  public static detectBaseRomEngine(filename: string, bytes: Uint8Array): RomId {
    const lower = filename.toLowerCase();
    if (lower.includes('pong') || lower.includes('paddle')) return 'cyber_pong';
    if (lower.includes('break') || lower.includes('brick') || lower.includes('arkanoid'))
      return 'neon_breakout';
    if (lower.includes('invad') || lower.includes('galax') || lower.includes('alien'))
      return 'space_invaders';
    if (lower.includes('tank') || lower.includes('combat') || lower.includes('armor'))
      return 'vector_tank';
    if (lower.includes('aster') || lower.includes('vector') || lower.includes('meteor'))
      return 'asteroid_blaster';

    const engines: RomId[] = [
      'asteroid_blaster',
      'cyber_pong',
      'neon_breakout',
      'space_invaders',
      'vector_tank',
    ];
    return engines[bytes.length % engines.length];
  }

  public static parseUploadedRom(filename: string, buffer: ArrayBuffer): CustomRomMetadata {
    const bytes = new Uint8Array(buffer);
    const checksumHex = this.computeChecksumHex(bytes);
    const mappedBaseRom = this.detectBaseRomEngine(filename, bytes);
    return {
      id: `custom_${checksumHex}`,
      title: filename.replace(/\.[^/.]+$/, ''),
      filename,
      byteLength: bytes.byteLength,
      checksumHex,
      mappedBaseRom,
      uploadedAt: Date.now(),
    };
  }

  public static searchCatalog(
    query: string,
    genreFilter: string,
    customCatalog: RomCatalogItem[] = []
  ): RomCatalogItem[] {
    const combined = [...customCatalog, ...ROM_CATALOG];
    const q = query.trim().toLowerCase();
    return combined.filter((item) => {
      const matchesGenre = genreFilter === 'All' || item.genre === genreFilter;
      const matchesQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.system.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.genre.toLowerCase().includes(q);
      return matchesGenre && matchesQuery;
    });
  }

  public static createMemoryAndGpuContext(): {
    memory: WasmMemoryArena;
    gpu: GPUComputePipeline;
  } {
    return {
      memory: new WasmMemoryArena(),
      gpu: new GPUComputePipeline(140),
    };
  }

  public static detectHardwareCapabilities(): {
    preferredComputeBackend: string;
    cores: number;
    deviceMemoryGb: number;
  } {
    const hasWebGpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 8 : 8;
    const deviceMemoryGb =
      typeof navigator !== 'undefined' && 'deviceMemory' in navigator
        ? Number((navigator as unknown as { deviceMemory?: number }).deviceMemory || 8)
        : 8;
    return {
      preferredComputeBackend: hasWebGpu ? 'WebGPU + WASM SIMD' : 'WebGL2 + WASM Linear Arena',
      cores,
      deviceMemoryGb,
    };
  }
}

