// Pillar 4: Web — Phaser-Style Arcade Runtime & Multi-ROM Emulator Engine
import { WasmMemoryArena } from './wasmMemory.ts';
import { GPUComputePipeline } from './gpuCompute.ts';
import { nativeBridge } from '../app/nativeBindings.ts';

export type RomId =
  | 'cyber_pong'
  | 'neon_breakout'
  | 'asteroid_blaster'
  | 'space_invaders'
  | 'vector_tank';

export interface RomCatalogItem {
  id: RomId;
  title: string;
  year: number;
  genre: 'Sports' | 'Arcade' | 'Vector' | 'Shooter' | 'Tactical';
  system: string;
  sizeKb: number;
  description: string;
}

export const ROM_CATALOG: RomCatalogItem[] = [
  {
    id: 'cyber_pong',
    title: 'Cyber Pong 2088',
    year: 1972,
    genre: 'Sports',
    system: 'Sovereign-WASM-8',
    sizeKb: 16,
    description: 'High-speed dual-paddle arena with adaptive AI velocity and spin physics.',
  },
  {
    id: 'neon_breakout',
    title: 'Obsidian Brick Breaker',
    year: 1976,
    genre: 'Arcade',
    system: 'Sovereign-WASM-8',
    sizeKb: 24,
    description: 'Multi-tier golden energy bricks with combo multipliers and particle shrapnel.',
  },
  {
    id: 'asteroid_blaster',
    title: 'Asteroid Vector DX',
    year: 1979,
    genre: 'Vector',
    system: 'Vector-XY-WASM',
    sizeKb: 32,
    description: '360-degree rotational thrust, splitting vector boulders, and plasma cannon.',
  },
  {
    id: 'space_invaders',
    title: 'Galactic Armada 84',
    year: 1978,
    genre: 'Shooter',
    system: 'Arcade-Z80-WASM',
    sizeKb: 28,
    description: 'Descending alien formations, defensive bunkers, and rapid laser defense.',
  },
  {
    id: 'vector_tank',
    title: 'Battlezone Vector Tank',
    year: 1980,
    genre: 'Tactical',
    system: 'Vector-XY-WASM',
    sizeKb: 48,
    description: 'Top-down armored combat with ricochet shells and enemy turret AI.',
  },
];

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  alive: boolean;
  color: string;
  points: number;
}

interface Asteroid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  sides: number;
  angle: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  fromEnemy?: boolean;
}

interface Invader {
  x: number;
  y: number;
  row: number;
  alive: boolean;
}

export interface EmulatorMatchResult {
  romId: RomId;
  romTitle: string;
  outcome: 'win' | 'loss';
  score: number;
  wave: number;
}

export class PhaserWasmEmulator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private memory: WasmMemoryArena;
  private gpu: GPUComputePipeline;
  private rom: RomId = 'asteroid_blaster';
  private customRomTitle: string | null = null;
  private animId: number | null = null;
  private lastTime = 0;
  private onMatchEndCallback?: (result: EmulatorMatchResult) => void;
  private winModalShownForWave = 0;
  private gameOverModalShown = false;

  // Input flags
  private keys: Record<string, boolean> = {};
  private lastFireTime = 0;

  // Pong & Breakout state
  private aiPaddleY = 180;
  private ballStuck = false;
  private bricks: Brick[] = [];

  // Asteroid Vector DX state
  private shipX = 360;
  private shipY = 220;
  private shipAngle = -Math.PI / 2;
  private shipVx = 0;
  private shipVy = 0;
  private asteroids: Asteroid[] = [];
  private bullets: Bullet[] = [];

  // Space Invaders state
  private invaders: Invader[] = [];
  private invaderDir = 1;
  private invaderStepTimer = 0;

  // Vector Tank state
  private enemyTankX = 560;
  private enemyTankY = 120;
  private enemyTankAngle = Math.PI;
  private enemyCooldown = 0;

  constructor(
    canvas: HTMLCanvasElement,
    memory: WasmMemoryArena,
    gpu: GPUComputePipeline,
    onMatchEnd?: (result: EmulatorMatchResult) => void
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D Canvas context unavailable');
    this.ctx = context;
    this.memory = memory;
    this.gpu = gpu;
    this.onMatchEndCallback = onMatchEnd;
    this.loadRom('asteroid_blaster');
  }

  public setOnMatchEnd(cb: (result: EmulatorMatchResult) => void): void {
    this.onMatchEndCallback = cb;
  }

  public getCurrentRomTitle(): string {
    if (this.customRomTitle) return this.customRomTitle;
    return ROM_CATALOG.find((r) => r.id === this.rom)?.title || this.rom;
  }

  public loadRom(romId: RomId, customTitle?: string): void {
    this.rom = romId;
    this.customRomTitle = customTitle || null;
    this.memory.resetArena();
    this.bullets = [];
    this.keys = {};
    this.winModalShownForWave = 0;
    this.gameOverModalShown = false;

    if (romId === 'cyber_pong') {
      this.memory.setPaddleX(180);
      this.aiPaddleY = 180;
      this.memory.setBall(360, 220, -290, 175);
      this.ballStuck = false;
    } else if (romId === 'neon_breakout') {
      this.memory.setPaddleX(300);
      this.memory.setBall(350, 385, 220, -250);
      this.ballStuck = true;
      this.initBricks();
    } else if (romId === 'asteroid_blaster') {
      this.shipX = 360;
      this.shipY = 220;
      this.shipAngle = -Math.PI / 2;
      this.shipVx = 0;
      this.shipVy = 0;
      this.spawnAsteroids(5);
    } else if (romId === 'space_invaders') {
      this.memory.setPaddleX(330);
      this.initInvaders();
    } else if (romId === 'vector_tank') {
      this.shipX = 140;
      this.shipY = 220;
      this.shipAngle = 0;
      this.enemyTankX = 580;
      this.enemyTankY = 220;
      this.enemyTankAngle = Math.PI;
    }
  }

  private initBricks(): void {
    this.bricks = [];
    const colors = ['#FACC15', '#EAB308', '#F59E0B', '#FEF08A', '#CA8A04'];
    const cols = 9;
    const rows = 5;
    const pad = 8;
    const w = 66;
    const h = 20;
    const startX = 28;
    const startY = 48;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.bricks.push({
          x: startX + c * (w + pad),
          y: startY + r * (h + pad),
          w,
          h,
          alive: true,
          color: colors[r % colors.length],
          points: (rows - r) * 25,
        });
      }
    }
  }

  private initInvaders(): void {
    this.invaders = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        this.invaders.push({
          x: 90 + c * 62,
          y: 55 + r * 38,
          row: r,
          alive: true,
        });
      }
    }
    this.invaderDir = 1;
  }

  private spawnAsteroids(count: number): void {
    this.asteroids = [];
    for (let i = 0; i < count; i++) {
      // Spawn away from the player's ship (this.shipX, this.shipY) so asteroids never spawn on top of the ship
      let ax = 80 + Math.random() * 560;
      let ay = 60 + Math.random() * 320;
      if (Math.hypot(ax - this.shipX, ay - this.shipY) < 120) {
        ax = (ax + 260) % 700;
        ay = (ay + 180) % 420;
      }
      const angle = Math.random() * Math.PI * 2;
      const speed = 55 + Math.random() * 75;
      this.asteroids.push({
        x: ax,
        y: ay,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 34,
        sides: 7 + Math.floor(Math.random() * 3),
        angle: 0,
      });
    }
  }

  public setKeyState(code: string, isDown: boolean): void {
    this.keys[code] = isDown;

    // IMPORTANT FIX: Only Enter or KeyR restarts after Game Over.
    // Pressing Space NEVER resets the game! Space strictly fires weapons or launches a stuck Breakout ball.
    if (isDown && (code === 'Enter' || code === 'KeyR') && this.memory.getLives() <= 0) {
      this.loadRom(this.rom, this.customRomTitle || undefined);
      nativeBridge.playSfx('card');
      return;
    }

    if (isDown && code === 'Space' && this.memory.getLives() > 0) {
      const now = performance.now();
      if (this.rom === 'neon_breakout' && this.ballStuck) {
        this.ballStuck = false;
        nativeBridge.playSfx('move');
      } else if (this.rom === 'asteroid_blaster' && now - this.lastFireTime > 140) {
        this.lastFireTime = now;
        this.fireAsteroidBullet();
      } else if (this.rom === 'space_invaders' && now - this.lastFireTime > 200) {
        this.lastFireTime = now;
        this.fireInvaderLaser();
      } else if (this.rom === 'vector_tank' && now - this.lastFireTime > 240) {
        this.lastFireTime = now;
        this.fireTankShell(false);
      }
    }
  }

  private fireAsteroidBullet(): void {
    if (this.bullets.length >= 12) return;
    this.bullets.push({
      x: this.shipX + Math.cos(this.shipAngle) * 16,
      y: this.shipY + Math.sin(this.shipAngle) * 16,
      vx: Math.cos(this.shipAngle) * 420 + this.shipVx * 0.25,
      vy: Math.sin(this.shipAngle) * 420 + this.shipVy * 0.25,
      life: 1.25,
    });
    nativeBridge.playSfx('move');
  }

  private fireInvaderLaser(): void {
    const px = this.memory.getPaddleX();
    if (this.bullets.filter((b) => !b.fromEnemy).length >= 4) return;
    this.bullets.push({
      x: px + 24,
      y: 396,
      vx: 0,
      vy: -420,
      life: 1.5,
      fromEnemy: false,
    });
    nativeBridge.playSfx('move');
  }

  private fireTankShell(fromEnemy: boolean): void {
    const x = fromEnemy ? this.enemyTankX : this.shipX;
    const y = fromEnemy ? this.enemyTankY : this.shipY;
    const ang = fromEnemy ? this.enemyTankAngle : this.shipAngle;
    this.bullets.push({
      x: x + Math.cos(ang) * 20,
      y: y + Math.sin(ang) * 20,
      vx: Math.cos(ang) * 340,
      vy: Math.sin(ang) * 340,
      life: 1.6,
      fromEnemy,
    });
    nativeBridge.playSfx('move');
  }

  public start(): void {
    if (this.animId !== null) return;
    this.lastTime = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      this.update(dt);
      this.render();
      this.animId = requestAnimationFrame(tick);
    };
    this.animId = requestAnimationFrame(tick);
  }

  public stop(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  private checkMilestones(): void {
    const lives = this.memory.getLives();
    const wave = this.memory.getWave();
    const score = this.memory.getScore();

    if (lives <= 0 && !this.gameOverModalShown) {
      this.gameOverModalShown = true;
      this.onMatchEndCallback?.({
        romId: this.rom,
        romTitle: this.getCurrentRomTitle(),
        outcome: score >= 150 ? 'win' : 'loss',
        score,
        wave,
      });
    } else if (wave >= 2 && this.winModalShownForWave === 0 && score >= 200) {
      this.winModalShownForWave = wave;
      this.onMatchEndCallback?.({
        romId: this.rom,
        romTitle: this.getCurrentRomTitle(),
        outcome: 'win',
        score,
        wave,
      });
    }
  }

  private update(dt: number): void {
    this.memory.incrementFrame();
    this.gpu.stepSimulation(dt);

    if (this.memory.getLives() <= 0) {
      this.checkMilestones();
      return;
    }

    const left = this.keys['ArrowLeft'] || this.keys['KeyA'];
    const right = this.keys['ArrowRight'] || this.keys['KeyD'];
    const up = this.keys['ArrowUp'] || this.keys['KeyW'];
    const down = this.keys['ArrowDown'] || this.keys['KeyS'];
    const spaceHeld = this.keys['Space'];

    // Continuous rapid fire when holding Spacebar in Asteroid / Invaders / Tank
    if (spaceHeld) {
      const now = performance.now();
      if (this.rom === 'asteroid_blaster' && now - this.lastFireTime > 210) {
        this.lastFireTime = now;
        this.fireAsteroidBullet();
      } else if (this.rom === 'space_invaders' && now - this.lastFireTime > 280) {
        this.lastFireTime = now;
        this.fireInvaderLaser();
      }
    }

    if (this.rom === 'cyber_pong') {
      let py = this.memory.getPaddleX();
      if (up || left) py -= 340 * dt;
      if (down || right) py += 340 * dt;
      py = Math.max(20, Math.min(350, py));
      this.memory.setPaddleX(py);

      const ball = this.memory.getBall();
      let bx = ball.x + ball.vx * dt;
      let by = ball.y + ball.vy * dt;
      let bvx = ball.vx;
      let bvy = ball.vy;

      if (by < 14 || by > 426) {
        bvy = -bvy;
        by = Math.max(14, Math.min(426, by));
        nativeBridge.playSfx('move');
      }

      const aiCenter = this.aiPaddleY + 35;
      if (aiCenter < by - 10) this.aiPaddleY += 250 * dt;
      if (aiCenter > by + 10) this.aiPaddleY -= 250 * dt;
      this.aiPaddleY = Math.max(20, Math.min(350, this.aiPaddleY));

      if (bx <= 38 && by >= py && by <= py + 72 && bvx < 0) {
        bvx = -bvx * 1.04;
        bx = 39;
        this.memory.setScore(this.memory.getScore() + 25);
        this.gpu.spawnBurst(bx, by);
        nativeBridge.playSfx('hit');
      }

      if (bx >= 682 && by >= this.aiPaddleY && by <= this.aiPaddleY + 72 && bvx > 0) {
        bvx = -bvx * 1.03;
        bx = 681;
        this.gpu.spawnBurst(bx, by);
        nativeBridge.playSfx('move');
      }

      if (bx < 0) {
        this.memory.setLives(this.memory.getLives() - 1);
        nativeBridge.playSfx('error');
        bx = 360;
        by = 220;
        bvx = -280;
      } else if (bx > 720) {
        this.memory.setScore(this.memory.getScore() + 150);
        this.memory.setWave(this.memory.getWave() + 1);
        this.gpu.spawnBurst(690, by);
        nativeBridge.playSfx('victory');
        bx = 360;
        by = 220;
        bvx = -295;
      }

      this.memory.setBall(bx, by, bvx, bvy);
    } else if (this.rom === 'neon_breakout') {
      let px = this.memory.getPaddleX();
      if (left) px -= 410 * dt;
      if (right) px += 410 * dt;
      px = Math.max(16, Math.min(604, px));
      this.memory.setPaddleX(px);

      const ball = this.memory.getBall();
      if (this.ballStuck) {
        this.memory.setBall(px + 50, 392, 220, -250);
        return;
      }

      let bx = ball.x + ball.vx * dt;
      let by = ball.y + ball.vy * dt;
      let bvx = ball.vx;
      let bvy = ball.vy;

      if (bx < 12 || bx > 708) bvx = -bvx;
      if (by < 14) bvy = -bvy;

      if (by >= 395 && by <= 412 && bx >= px && bx <= px + 100 && bvy > 0) {
        const offset = (bx - (px + 50)) / 50;
        bvx = offset * 300;
        bvy = -Math.abs(bvy);
        this.gpu.spawnBurst(bx, by);
        nativeBridge.playSfx('move');
      }

      for (const b of this.bricks) {
        if (!b.alive) continue;
        if (bx >= b.x && bx <= b.x + b.w && by >= b.y && by <= b.y + b.h) {
          b.alive = false;
          bvy = -bvy;
          this.memory.setScore(this.memory.getScore() + b.points);
          this.gpu.spawnBurst(bx, by);
          nativeBridge.playSfx('hit');
          break;
        }
      }

      if (this.bricks.every((b) => !b.alive)) {
        this.memory.setWave(this.memory.getWave() + 1);
        this.memory.setScore(this.memory.getScore() + 300);
        this.initBricks();
        this.ballStuck = true;
        nativeBridge.playSfx('victory');
      }

      if (by > 440) {
        this.memory.setLives(this.memory.getLives() - 1);
        this.ballStuck = true;
        nativeBridge.playSfx('error');
      }

      this.memory.setBall(bx, by, bvx, bvy);
    } else if (this.rom === 'asteroid_blaster') {
      if (left) this.shipAngle -= 3.8 * dt;
      if (right) this.shipAngle += 3.8 * dt;
      if (up) {
        this.shipVx += Math.cos(this.shipAngle) * 230 * dt;
        this.shipVy += Math.sin(this.shipAngle) * 230 * dt;
      }
      if (down) {
        this.shipVx *= 0.94;
        this.shipVy *= 0.94;
      }
      this.shipVx *= 0.992;
      this.shipVy *= 0.992;
      this.shipX = (this.shipX + this.shipVx * dt + 720) % 720;
      this.shipY = (this.shipY + this.shipVy * dt + 440) % 440;

      this.bullets = this.bullets
        .map((b) => ({
          ...b,
          x: (b.x + b.vx * dt + 720) % 720,
          y: (b.y + b.vy * dt + 440) % 440,
          life: b.life - dt,
        }))
        .filter((b) => b.life > 0);

      const nextAsteroids: Asteroid[] = [];
      for (const a of this.asteroids) {
        a.x = (a.x + a.vx * dt + 720) % 720;
        a.y = (a.y + a.vy * dt + 440) % 440;
        a.angle += 1.1 * dt;

        let hit = false;
        for (const b of this.bullets) {
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < a.radius) {
            hit = true;
            b.life = 0;
            this.memory.setScore(this.memory.getScore() + 60);
            this.gpu.spawnBurst(a.x, a.y);
            nativeBridge.playSfx('hit');
            if (a.radius > 18) {
              for (let s = 0; s < 2; s++) {
                const ang = Math.random() * Math.PI * 2;
                nextAsteroids.push({
                  x: a.x,
                  y: a.y,
                  vx: Math.cos(ang) * 115,
                  vy: Math.sin(ang) * 115,
                  radius: a.radius * 0.58,
                  sides: a.sides,
                  angle: 0,
                });
              }
            }
            break;
          }
        }

        if (!hit) {
          if (Math.hypot(a.x - this.shipX, a.y - this.shipY) < a.radius + 10) {
            this.memory.setLives(this.memory.getLives() - 1);
            this.gpu.spawnBurst(this.shipX, this.shipY);
            nativeBridge.playSfx('error');
            this.shipX = 360;
            this.shipY = 220;
            this.shipVx = 0;
            this.shipVy = 0;
          }
          nextAsteroids.push(a);
        }
      }

      this.asteroids = nextAsteroids;
      if (this.asteroids.length === 0) {
        this.memory.setWave(this.memory.getWave() + 1);
        this.memory.setScore(this.memory.getScore() + 200);
        this.spawnAsteroids(4 + this.memory.getWave());
        nativeBridge.playSfx('victory');
      }
    } else if (this.rom === 'space_invaders') {
      let px = this.memory.getPaddleX();
      if (left) px -= 340 * dt;
      if (right) px += 340 * dt;
      px = Math.max(24, Math.min(648, px));
      this.memory.setPaddleX(px);

      this.invaderStepTimer += dt;
      if (this.invaderStepTimer > 0.45) {
        this.invaderStepTimer = 0;
        let hitEdge = false;
        for (const inv of this.invaders) {
          if (!inv.alive) continue;
          inv.x += this.invaderDir * 16;
          if (inv.x > 665 || inv.x < 35) hitEdge = true;
        }
        if (hitEdge) {
          this.invaderDir = -this.invaderDir;
          for (const inv of this.invaders) {
            if (inv.alive) {
              inv.y += 16;
              if (inv.y >= 380) {
                this.memory.setLives(0);
              }
            }
          }
        }
      }

      this.bullets = this.bullets
        .map((b) => ({ ...b, y: b.y + b.vy * dt, life: b.life - dt }))
        .filter((b) => b.life > 0 && b.y > 0 && b.y < 440);

      for (const b of this.bullets) {
        for (const inv of this.invaders) {
          if (!inv.alive) continue;
          if (Math.abs(b.x - inv.x) < 20 && Math.abs(b.y - inv.y) < 15) {
            inv.alive = false;
            b.life = 0;
            this.memory.setScore(this.memory.getScore() + (4 - inv.row) * 30);
            this.gpu.spawnBurst(inv.x, inv.y);
            nativeBridge.playSfx('hit');
            break;
          }
        }
      }

      if (this.invaders.every((i) => !i.alive)) {
        this.memory.setWave(this.memory.getWave() + 1);
        this.memory.setScore(this.memory.getScore() + 250);
        this.initInvaders();
        nativeBridge.playSfx('victory');
      }
    } else if (this.rom === 'vector_tank') {
      if (left) this.shipAngle -= 2.8 * dt;
      if (right) this.shipAngle += 2.8 * dt;
      if (up) {
        this.shipX = Math.max(30, Math.min(690, this.shipX + Math.cos(this.shipAngle) * 145 * dt));
        this.shipY = Math.max(30, Math.min(410, this.shipY + Math.sin(this.shipAngle) * 145 * dt));
      }
      if (down) {
        this.shipX = Math.max(30, Math.min(690, this.shipX - Math.cos(this.shipAngle) * 100 * dt));
        this.shipY = Math.max(30, Math.min(410, this.shipY - Math.sin(this.shipAngle) * 100 * dt));
      }

      const targetAng = Math.atan2(this.shipY - this.enemyTankY, this.shipX - this.enemyTankX);
      this.enemyTankAngle = targetAng;
      this.enemyTankX += Math.cos(targetAng) * 65 * dt;
      this.enemyTankY += Math.sin(targetAng) * 65 * dt;

      this.enemyCooldown -= dt;
      if (this.enemyCooldown <= 0) {
        this.enemyCooldown = 1.8;
        this.fireTankShell(true);
      }

      this.bullets = this.bullets
        .map((b) => ({
          ...b,
          x: b.x + b.vx * dt,
          y: b.y + b.vy * dt,
          life: b.life - dt,
        }))
        .filter((b) => b.life > 0 && b.x > 0 && b.x < 720 && b.y > 0 && b.y < 440);

      for (const b of this.bullets) {
        if (!b.fromEnemy && Math.hypot(b.x - this.enemyTankX, b.y - this.enemyTankY) < 22) {
          b.life = 0;
          this.memory.setScore(this.memory.getScore() + 140);
          this.memory.setWave(this.memory.getWave() + 1);
          this.gpu.spawnBurst(this.enemyTankX, this.enemyTankY);
          nativeBridge.playSfx('hit');
          this.enemyTankX = 120 + Math.random() * 480;
          this.enemyTankY = 70 + Math.random() * 300;
        } else if (b.fromEnemy && Math.hypot(b.x - this.shipX, b.y - this.shipY) < 20) {
          b.life = 0;
          this.memory.setLives(this.memory.getLives() - 1);
          this.gpu.spawnBurst(this.shipX, this.shipY);
          nativeBridge.playSfx('error');
        }
      }
    }

    this.checkMilestones();
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#070709';
    ctx.fillRect(0, 0, 720, 440);

    // Subtle Obsidian & Cyber Gold CRT grid
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 720; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 440);
      ctx.stroke();
    }
    for (let y = 0; y < 440; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(720, y);
      ctx.stroke();
    }

    if (this.rom === 'cyber_pong') {
      const py = this.memory.getPaddleX();
      const ball = this.memory.getBall();

      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.25)';
      ctx.beginPath();
      ctx.moveTo(360, 0);
      ctx.lineTo(360, 440);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#FACC15';
      ctx.fillRect(24, py, 12, 72);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(684, this.aiPaddleY, 12, 72);

      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.rom === 'neon_breakout') {
      const px = this.memory.getPaddleX();
      const ball = this.memory.getBall();

      ctx.fillStyle = '#FACC15';
      ctx.fillRect(px, 402, 100, 12);

      for (const b of this.bricks) {
        if (!b.alive) continue;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }

      ctx.fillStyle = '#FEF9C3';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.rom === 'asteroid_blaster') {
      ctx.save();
      ctx.translate(this.shipX, this.shipY);
      ctx.rotate(this.shipAngle);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-13, -11);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-13, 11);
      ctx.closePath();
      ctx.stroke();
      if (this.keys['ArrowUp'] || this.keys['KeyW']) {
        ctx.strokeStyle = '#F59E0B';
        ctx.beginPath();
        ctx.moveTo(-10, -5);
        ctx.lineTo(-22, 0);
        ctx.lineTo(-10, 5);
        ctx.stroke();
      }
      ctx.restore();

      ctx.strokeStyle = '#EAB308';
      ctx.lineWidth = 2;
      for (const a of this.asteroids) {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.angle);
        ctx.beginPath();
        for (let i = 0; i < a.sides; i++) {
          const ang = (i / a.sides) * Math.PI * 2;
          const r = a.radius * (i % 2 === 0 ? 1 : 0.84);
          const vx = Math.cos(ang) * r;
          const vy = Math.sin(ang) * r;
          if (i === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = '#FEF08A';
      for (const b of this.bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.rom === 'space_invaders') {
      const px = this.memory.getPaddleX();
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(px, 405, 48, 12);
      ctx.fillRect(px + 18, 396, 12, 10);

      for (const inv of this.invaders) {
        if (!inv.alive) continue;
        ctx.fillStyle = inv.row % 2 === 0 ? '#FACC15' : '#F59E0B';
        ctx.fillRect(inv.x - 16, inv.y - 10, 32, 20);
        ctx.fillStyle = '#070709';
        ctx.fillRect(inv.x - 8, inv.y - 4, 4, 4);
        ctx.fillRect(inv.x + 4, inv.y - 4, 4, 4);
      }

      ctx.fillStyle = '#FEF08A';
      for (const b of this.bullets) {
        ctx.fillRect(b.x - 2, b.y - 6, 4, 12);
      }
    } else if (this.rom === 'vector_tank') {
      const drawTank = (x: number, y: number, ang: number, color: string) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;
        ctx.strokeRect(-16, -13, 32, 26);
        ctx.strokeRect(-8, -8, 16, 16);
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(24, 0);
        ctx.stroke();
        ctx.restore();
      };

      drawTank(this.shipX, this.shipY, this.shipAngle, '#FACC15');
      drawTank(this.enemyTankX, this.enemyTankY, this.enemyTankAngle, '#F59E0B');

      for (const b of this.bullets) {
        ctx.fillStyle = b.fromEnemy ? '#F59E0B' : '#FEF08A';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // GPU Particle Overlay
    const particles = this.gpu.getBuffer();
    for (let i = 0; i < particles.length; i += 4) {
      const life = particles[i + 3];
      if (life > 0.05) {
        ctx.fillStyle = `rgba(250, 204, 21, ${life * 0.7})`;
        ctx.fillRect(particles[i], particles[i + 1], 3, 3);
      }
    }

    // Canvas HUD Telemetry Bar
    ctx.fillStyle = '#FEFCE8';
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillText(`ROM: ${this.getCurrentRomTitle().toUpperCase()}`, 18, 24);
    ctx.fillStyle = '#FACC15';
    ctx.fillText(`SCORE: ${this.memory.getScore()}`, 300, 24);
    ctx.fillText(`WAVE: ${this.memory.getWave()}`, 460, 24);
    ctx.fillText(`LIVES: ${'★'.repeat(Math.max(0, this.memory.getLives()))}`, 590, 24);

    if (this.memory.getLives() <= 0) {
      ctx.fillStyle = 'rgba(7, 7, 9, 0.88)';
      ctx.fillRect(0, 0, 720, 440);
      ctx.fillStyle = '#FACC15';
      ctx.font = 'bold 28px "Outfit", sans-serif';
      ctx.fillText('RUN COMPLETE — PRESS ENTER OR R TO REBOOT', 90, 215);
      ctx.fillStyle = '#FEFCE8';
      ctx.font = '15px "JetBrains Mono", monospace';
      ctx.fillText(`FINAL SCORE: ${this.memory.getScore()} · WAVE REACHED: ${this.memory.getWave()}`, 195, 250);
    }
  }
}
