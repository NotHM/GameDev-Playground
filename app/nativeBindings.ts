// Pillar 3: App — OS Window Management, jsgamelauncher Bridge & Procedural Web Audio Synth

export type SfxKind = 'card' | 'chip' | 'hit' | 'victory' | 'move' | 'uno' | 'error' | 'powerup';

class NativeAudioAndWindowBridge {
  private ctx: AudioContext | null = null;
  private isMuted = true;
  private synthLoopTimer: number | null = null;
  private isSynthLoopPlaying = false;
  private stepIndex = 0;

  private ensureContext(): AudioContext | null {
    if (this.isMuted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopProceduralSoundtrack();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public playSfx(kind: SfxKind) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (kind) {
      case 'card': {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(190, now + 0.055);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.065);
        break;
      }
      case 'chip': {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1480, now);
        osc.frequency.setValueAtTime(2220, now + 0.025);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.start(now);
        osc.stop(now + 0.095);
        break;
      }
      case 'move': {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.exponentialRampToValueAtTime(480, now + 0.07);
        gain.gain.setValueAtTime(0.11, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }
      case 'hit': {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.11);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.125);
        break;
      }
      case 'powerup':
      case 'uno': {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(659.25, now + 0.06);
        osc.frequency.setValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.start(now);
        osc.stop(now + 0.25);
        break;
      }
      case 'victory': {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'triangle';
          o.connect(g);
          g.connect(ctx.destination);
          const start = now + idx * 0.08;
          o.frequency.setValueAtTime(freq, start);
          g.gain.setValueAtTime(0.14, start);
          g.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
          o.start(start);
          o.stop(start + 0.25);
        });
        break;
      }
      case 'error': {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.setValueAtTime(115, now + 0.08);
        gain.gain.setValueAtTime(0.13, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.19);
        break;
      }
    }
  }

  public startProceduralSoundtrack() {
    if (this.isMuted || this.isSynthLoopPlaying) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.isSynthLoopPlaying = true;
    // Cool emerald velvet chord arpeggio in D Dorian (D3, F3, A3, C4, E4, G4)
    const scale = [146.83, 174.61, 220.0, 261.63, 329.63, 392.0, 293.66, 220.0];
    this.synthLoopTimer = window.setInterval(() => {
      if (this.isMuted || !this.isSynthLoopPlaying) return;
      const c = this.ensureContext();
      if (!c) return;
      const now = c.currentTime;
      const freq = scale[this.stepIndex % scale.length];
      this.stepIndex++;

      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.38);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    }, 420);
  }

  public stopProceduralSoundtrack() {
    this.isSynthLoopPlaying = false;
    if (this.synthLoopTimer !== null) {
      clearInterval(this.synthLoopTimer);
      this.synthLoopTimer = null;
    }
  }

  public isSoundtrackPlaying(): boolean {
    return this.isSynthLoopPlaying;
  }

  public async toggleFullscreen(): Promise<boolean> {
    if (typeof document === 'undefined') return false;
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        return true;
      } else {
        await document.exitFullscreen();
        return false;
      }
    } catch {
      return false;
    }
  }

  public getRuntimeDescriptor(): { runtime: string; sdlBridge: string; audioSampleRate: number } {
    const isJsGameLauncher =
      typeof navigator !== 'undefined' && /jsgamelauncher|rungame|electron/i.test(navigator.userAgent);
    return {
      runtime: isJsGameLauncher ? 'jsgamelauncher Native SDL2' : 'Web/Wasm Hybrid Container',
      sdlBridge: isJsGameLauncher ? 'Active (Direct Framebuffer)' : 'WebGL2 + Canvas2D Bridge',
      audioSampleRate: this.ctx?.sampleRate || 48000,
    };
  }
}

export const nativeBridge = new NativeAudioAndWindowBridge();
