// Pillar 4: Web — WebAssembly.Memory Linear Buffer Manager & Live Hex Memory Patcher (memoryjs workflow)

export interface MemoryInspectionRow {
  addressHex: string;
  bytesHex: string[];
  ascii: string;
  label: string;
}

export class WasmLinearMemoryCore {
  private wasmMemory: WebAssembly.Memory;
  private bytes: Uint8Array;
  private view: DataView;

  // Documented Register Offsets in ARCHITECTURE.md
  public static readonly ADDR_MAGIC = 0x0000; // 4 bytes: 'AETH'
  public static readonly ADDR_ROM_ID = 0x0004; // Uint32
  public static readonly ADDR_SCORE = 0x0008; // Uint32
  public static readonly ADDR_HI_SCORE = 0x000c; // Uint32
  public static readonly ADDR_LIVES = 0x0010; // Uint8
  public static readonly ADDR_LEVEL = 0x0011; // Uint8
  public static readonly ADDR_SPEED_SCALE = 0x0012; // Uint8 (100 = 1.0x)
  public static readonly ADDR_FLAGS = 0x0013; // Uint8 bitmask (bit 0: paused, bit 1: godMode, bit 2: crtShader)
  public static readonly ADDR_HERO_X = 0x0020; // Float32
  public static readonly ADDR_HERO_Y = 0x0024; // Float32
  public static readonly ADDR_HERO_VX = 0x0028; // Float32
  public static readonly ADDR_HERO_VY = 0x002c; // Float32

  constructor() {
    this.wasmMemory = new WebAssembly.Memory({ initial: 1, maximum: 4 }); // 64KB initial page
    this.bytes = new Uint8Array(this.wasmMemory.buffer);
    this.view = new DataView(this.wasmMemory.buffer);
    this.initializeHeader(1);
  }

  public initializeHeader(romId: number) {
    // Write ASCII 'AETH' (0x41, 0x45, 0x54, 0x48)
    this.bytes[0] = 0x41;
    this.bytes[1] = 0x45;
    this.bytes[2] = 0x54;
    this.bytes[3] = 0x48;
    this.setRomId(romId);
    this.setScore(0);
    if (this.getHiScore() === 0) {
      this.setHiScore(1200);
    }
    this.setLives(3);
    this.setLevel(1);
    this.setSpeedScale(100);
    this.setFlags(0x04); // CRT enabled by default
  }

  public getRomId(): number {
    return this.view.getUint32(WasmLinearMemoryCore.ADDR_ROM_ID, true);
  }

  public setRomId(id: number) {
    this.view.setUint32(WasmLinearMemoryCore.ADDR_ROM_ID, id, true);
  }

  public getScore(): number {
    return this.view.getUint32(WasmLinearMemoryCore.ADDR_SCORE, true);
  }

  public setScore(score: number) {
    const clamped = Math.max(0, Math.floor(score));
    this.view.setUint32(WasmLinearMemoryCore.ADDR_SCORE, clamped, true);
    if (clamped > this.getHiScore()) {
      this.setHiScore(clamped);
    }
  }

  public getHiScore(): number {
    return this.view.getUint32(WasmLinearMemoryCore.ADDR_HI_SCORE, true);
  }

  public setHiScore(hi: number) {
    this.view.setUint32(WasmLinearMemoryCore.ADDR_HI_SCORE, Math.max(0, Math.floor(hi)), true);
  }

  public getLives(): number {
    return this.bytes[WasmLinearMemoryCore.ADDR_LIVES];
  }

  public setLives(lives: number) {
    this.bytes[WasmLinearMemoryCore.ADDR_LIVES] = Math.max(0, Math.min(99, Math.floor(lives)));
  }

  public getLevel(): number {
    return this.bytes[WasmLinearMemoryCore.ADDR_LEVEL];
  }

  public setLevel(level: number) {
    this.bytes[WasmLinearMemoryCore.ADDR_LEVEL] = Math.max(1, Math.min(99, Math.floor(level)));
  }

  public getSpeedScale(): number {
    return this.bytes[WasmLinearMemoryCore.ADDR_SPEED_SCALE] || 100;
  }

  public setSpeedScale(scale: number) {
    this.bytes[WasmLinearMemoryCore.ADDR_SPEED_SCALE] = Math.max(25, Math.min(250, Math.floor(scale)));
  }

  public getFlags(): number {
    return this.bytes[WasmLinearMemoryCore.ADDR_FLAGS];
  }

  public setFlags(flags: number) {
    this.bytes[WasmLinearMemoryCore.ADDR_FLAGS] = flags & 0xff;
  }

  public isGodMode(): boolean {
    return (this.getFlags() & 0x02) !== 0;
  }

  public toggleGodMode(): boolean {
    const next = this.getFlags() ^ 0x02;
    this.setFlags(next);
    return (next & 0x02) !== 0;
  }

  public setHeroPose(x: number, y: number, vx: number, vy: number) {
    this.view.setFloat32(WasmLinearMemoryCore.ADDR_HERO_X, x, true);
    this.view.setFloat32(WasmLinearMemoryCore.ADDR_HERO_Y, y, true);
    this.view.setFloat32(WasmLinearMemoryCore.ADDR_HERO_VX, vx, true);
    this.view.setFloat32(WasmLinearMemoryCore.ADDR_HERO_VY, vy, true);
  }

  public resetArena() {
    this.initializeHeader(1);
    this.setWave(1);
    this.setLives(3);
    this.setScore(0);
    this.setPaddleX(300);
    this.setBall(360, 220, 220, -220);
  }

  public getWave(): number {
    return this.getLevel();
  }

  public setWave(wave: number) {
    this.setLevel(wave);
  }

  public getPaddleX(): number {
    return this.view.getFloat32(0x0030, true);
  }

  public setPaddleX(x: number) {
    this.view.setFloat32(0x0030, x, true);
  }

  public getBall(): { x: number; y: number; vx: number; vy: number } {
    return {
      x: this.view.getFloat32(WasmLinearMemoryCore.ADDR_HERO_X, true),
      y: this.view.getFloat32(WasmLinearMemoryCore.ADDR_HERO_Y, true),
      vx: this.view.getFloat32(WasmLinearMemoryCore.ADDR_HERO_VX, true),
      vy: this.view.getFloat32(WasmLinearMemoryCore.ADDR_HERO_VY, true),
    };
  }

  public setBall(x: number, y: number, vx: number, vy: number) {
    this.setHeroPose(x, y, vx, vy);
  }

  public incrementFrame() {
    const next = (this.view.getUint32(0x0034, true) + 1) >>> 0;
    this.view.setUint32(0x0034, next, true);
  }

  public getHexSnapshot(rowCount = 4): string[] {
    return this.getHexInspectionRows(rowCount).map(
      (r) => `${r.addressHex}: ${r.bytesHex.join(' ')}  |${r.ascii}|`
    );
  }

  // memoryjs-style direct byte patching
  public patchByte(address: number, byteValue: number) {
    if (address < 0 || address >= this.bytes.length) return;
    this.bytes[address] = byteValue & 0xff;
  }

  public readByte(address: number): number {
    if (address < 0 || address >= this.bytes.length) return 0;
    return this.bytes[address];
  }

  public getHexInspectionRows(rowCount = 6): MemoryInspectionRow[] {
    const labels: Record<number, string> = {
      0x0000: 'HEADER + ROM_ID + SCORE + HI_SCORE',
      0x0010: 'LIVES(0x10) · LVL(0x11) · SPD(0x12) · FLAGS(0x13)',
      0x0020: 'HERO_STRUCT (X, Y, VX, VY Float32)',
      0x0030: 'ENTITY_COUNTERS & TIMERS',
      0x0040: 'POOL_BUFFER_SLOTS [0..15]',
      0x0050: 'POOL_BUFFER_SLOTS [16..31]',
    };

    const rows: MemoryInspectionRow[] = [];
    for (let r = 0; r < rowCount; r++) {
      const base = r * 16;
      const bytesHex: string[] = [];
      let ascii = '';
      for (let i = 0; i < 16; i++) {
        const b = this.bytes[base + i];
        bytesHex.push(b.toString(16).toUpperCase().padStart(2, '0'));
        ascii += b >= 32 && b <= 126 ? String.fromCharCode(b) : '.';
      }
      rows.push({
        addressHex: `0x${base.toString(16).toUpperCase().padStart(4, '0')}`,
        bytesHex,
        ascii,
        label: labels[base] || 'LINEAR_WASM_HEAP',
      });
    }
    return rows;
  }

  public exportHexSnapshot(byteCount = 96): string {
    const slice = this.bytes.slice(0, byteCount);
    return Array.from(slice)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  public importHexSnapshot(hex: string) {
    const clean = hex.replace(/[^0-9a-fA-F]/g, '');
    const count = Math.min(this.bytes.length, Math.floor(clean.length / 2));
    for (let i = 0; i < count; i++) {
      this.bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
  }
}

export { WasmLinearMemoryCore as WasmMemoryArena };
export const sharedWasmMemory = new WasmLinearMemoryCore();

