// Pillar 4: Web — GPU Compute & Shader Post-Processing Pipeline (gpu.js / Canvas Compute Kernels)

export type ShaderPreset = 'clean' | 'crt_trinitron' | 'amber_phosphor';

export interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export class GpuComputePipeline {
  private particlePool: PooledParticle[] = [];
  private readonly poolSize: number;

  constructor(poolSize = 140) {
    this.poolSize = poolSize;
    for (let i = 0; i < this.poolSize; i++) {
      this.particlePool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 3,
        color: '#FACC15',
      });
    }
  }

  public emitBurst(x: number, y: number, count = 16, color = '#FACC15') {
    this.spawnBurst(x, y, color, count, 190);
  }

  public updateAndRender(ctx: CanvasRenderingContext2D, dt: number) {
    this.updateAndRenderParticles(ctx, dt);
  }

  public spawnBurst(x: number, y: number, color = '#FACC15', count = 16, speed = 190) {
    let spawned = 0;
    for (const p of this.particlePool) {
      if (!p.active) {
        const angle = (Math.PI * 2 * spawned) / count + (Math.random() - 0.5) * 0.35;
        const mag = speed * (0.45 + Math.random() * 0.75);
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * mag;
        p.vy = Math.sin(angle) * mag;
        p.maxLife = 0.25 + Math.random() * 0.35;
        p.life = p.maxLife;
        p.size = 2.5 + Math.random() * 3.5;
        p.color = color;
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  public stepSimulation(dt: number) {
    for (const p of this.particlePool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
  }

  public getBuffer(): Float32Array {
    const buf = new Float32Array(this.poolSize * 4);
    for (let i = 0; i < this.poolSize; i++) {
      const p = this.particlePool[i];
      const base = i * 4;
      buf[base] = p.x;
      buf[base + 1] = p.y;
      buf[base + 2] = p.size;
      buf[base + 3] = p.active ? Math.max(0, p.life / p.maxLife) : 0;
    }
    return buf;
  }

  public updateAndRenderParticles(ctx: CanvasRenderingContext2D, dt: number) {
    for (const p of this.particlePool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;

      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
      ctx.restore();
    }
  }

  public applyShaderPass(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    preset: ShaderPreset,
    timeSec: number
  ) {
    if (preset === 'clean') return;

    ctx.save();
    if (preset === 'amber_phosphor') {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
      ctx.fillRect(0, 0, width, height);
    }

    // Horizontal scanlines
    ctx.fillStyle = preset === 'amber_phosphor' ? 'rgba(20, 10, 0, 0.28)' : 'rgba(4, 12, 16, 0.24)';
    for (let y = 0; y < height; y += 4) {
      ctx.fillRect(0, y, width, 1.5);
    }

    // Subtle rolling refresh bar
    const barY = ((timeSec * 60) % (height + 80)) - 40;
    const grad = ctx.createLinearGradient(0, barY, 0, barY + 36);
    grad.addColorStop(0, 'rgba(250, 204, 21, 0)');
    grad.addColorStop(0.5, preset === 'amber_phosphor' ? 'rgba(251, 191, 36, 0.05)' : 'rgba(250, 204, 21, 0.05)');
    grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, barY, width, 36);

    // Corner CRT vignette
    const rad = ctx.createRadialGradient(width / 2, height / 2, width * 0.32, width / 2, height / 2, width * 0.65);
    rad.addColorStop(0, 'rgba(0,0,0,0)');
    rad.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

export { GpuComputePipeline as GPUComputePipeline };
export const gpuPipeline = new GpuComputePipeline();

