// Headless Dev Tools Pillar — Hardware & Runtime Compatibility Detector
import { LIQUID_MODEL_REGISTRY, LiquidModelId, QuantizationFormat } from './liquidModels.ts';

export interface HardwareCapabilityReport {
  cpuCores: number;
  estimatedRamMB: number;
  architectureHint: string;
  wasmSupported: boolean;
  wasmSimdSupported: boolean;
  wasmThreadsSupported: boolean;
  webGpuSupported: boolean;
  webGl2Supported: boolean;
  gamepadApiSupported: boolean;
  audioContextSupported: boolean;
  recommendedLiquidModel: LiquidModelId;
  recommendedQuantization: QuantizationFormat;
  recommendedEmulatorShader: 'crt_trinitron' | 'amber_phosphor' | 'clean';
  compatibilityTier: 'ULTRA_WORKSTATION' | 'HIGH_DESKTOP' | 'HANDHELD_EDGE' | 'RETRO_FALLBACK';
  notes: string[];
}

function checkWasmSimd(): boolean {
  try {
    // Minimal valid WebAssembly module containing a v128 SIMD instruction
    const simdBytes = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b, 0x03,
      0x02, 0x01, 0x00, 0x0a, 0x0a, 0x01, 0x08, 0x00,
      0x41, 0x00, 0xfd, 0x0f, 0xfd, 0x62, 0x0b,
    ]);
    return WebAssembly.validate(simdBytes);
  } catch {
    return false;
  }
}

export function detectHardwareAndCompatibility(): HardwareCapabilityReport {
  const isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined';
  const cpuCores = isBrowser
    ? navigator.hardwareConcurrency || 4
    : typeof process !== 'undefined'
    ? 8
    : 4;

  const deviceMemoryGB = isBrowser
    ? (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4
    : 8;
  const estimatedRamMB = deviceMemoryGB * 1024;

  const wasmSupported = typeof WebAssembly !== 'undefined';
  const wasmSimdSupported = wasmSupported && checkWasmSimd();
  const wasmThreadsSupported = typeof SharedArrayBuffer !== 'undefined';
  const webGpuSupported = isBrowser && 'gpu' in navigator;

  let webGl2Supported = false;
  if (isBrowser && typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      webGl2Supported = Boolean(canvas.getContext('webgl2'));
    } catch {
      webGl2Supported = false;
    }
  } else {
    webGl2Supported = true;
  }

  const gamepadApiSupported = isBrowser ? typeof navigator.getGamepads === 'function' : true;
  const audioContextSupported = isBrowser
    ? Boolean(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext)
    : true;

  let recommendedLiquidModel: LiquidModelId = 'lfm-1.1b-nano';
  let recommendedQuantization: QuantizationFormat = 'Q4_K_M';
  let compatibilityTier: HardwareCapabilityReport['compatibilityTier'] = 'HANDHELD_EDGE';

  if (estimatedRamMB >= 16384 && webGpuSupported && cpuCores >= 8) {
    recommendedLiquidModel = 'lfm-40b-moe';
    recommendedQuantization = 'Q8_0';
    compatibilityTier = 'ULTRA_WORKSTATION';
  } else if (estimatedRamMB >= 4096 && (webGpuSupported || webGl2Supported) && cpuCores >= 4) {
    recommendedLiquidModel = 'lfm-7b-liquid';
    recommendedQuantization = 'Q5_K_M';
    compatibilityTier = 'HIGH_DESKTOP';
  } else if (estimatedRamMB >= 2048 && wasmSimdSupported) {
    recommendedLiquidModel = 'lfm-3b-edge';
    recommendedQuantization = 'Q4_K_M';
    compatibilityTier = 'HANDHELD_EDGE';
  } else {
    recommendedLiquidModel = 'lfm-1.1b-nano';
    recommendedQuantization = 'Q4_K_M';
    compatibilityTier = 'RETRO_FALLBACK';
  }

  const modelSpec = LIQUID_MODEL_REGISTRY[recommendedLiquidModel];
  const notes: string[] = [
    `Detected ${cpuCores} logical cores and ~${estimatedRamMB}MB memory ceiling.`,
    `Selected ${modelSpec.name} (${recommendedQuantization}) as optimal local Liquid Model.`,
    wasmSimdSupported
      ? 'WebAssembly 128-bit SIMD acceleration verified.'
      : 'Wasm SIMD unavailable; falling back to scalar Wasm linear memory.',
  ];

  return {
    cpuCores,
    estimatedRamMB,
    architectureHint: isBrowser ? navigator.userAgent : `Node ${process.version} (${process.arch})`,
    wasmSupported,
    wasmSimdSupported,
    wasmThreadsSupported,
    webGpuSupported,
    webGl2Supported,
    gamepadApiSupported,
    audioContextSupported,
    recommendedLiquidModel,
    recommendedQuantization,
    recommendedEmulatorShader: webGl2Supported ? 'crt_trinitron' : 'clean',
    compatibilityTier,
    notes,
  };
}
