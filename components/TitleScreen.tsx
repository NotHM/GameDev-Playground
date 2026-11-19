// Pillar 2: Components — Full-Viewport Game Shell Title Screen with Live Interactive Black & Yellow Canvas & Bespoke SVG Lockup
import React, { useEffect, useRef } from 'react';
import { nativeBridge } from '../app/nativeBindings.ts';

interface TitleScreenProps {
  onEnterArena: (initialView?: 'cards' | 'boards' | 'emulator' | 'profile') => void;
  peerCount: number;
  playerHandle: string;
  bankroll: number;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onEnterArena,
  peerCount,
  playerHandle,
  bankroll,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        nativeBridge.playSfx('victory');
        onEnterArena('cards');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onEnterArena]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let t = 0;

    // Live-world atmospheric Black & Gold Tarot/Playing card pan
    const floatingCards = Array.from({ length: 14 }, (_, i) => ({
      x: (i * 137) % 1440,
      y: (i * 89) % 900,
      vx: (i % 2 === 0 ? 1 : -1) * (12 + (i % 5) * 4),
      vy: -14 - (i % 4) * 5,
      angle: (i * 0.45) % Math.PI,
      vAngle: (i % 2 === 0 ? 1 : -1) * 0.18,
      suit: ['♠', '★', '☾', '☀'][i % 4],
      rank: ['XXI', 'A', 'K', 'XVII', '0'][i % 5],
      isBright: i % 2 === 0,
    }));

    const render = () => {
      t += 0.016;
      const w = (canvas.width = window.innerWidth);
      const h = (canvas.height = window.innerHeight);

      const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.42, 40, w * 0.5, h * 0.5, w * 0.78);
      bgGrad.addColorStop(0, '#1F1905');
      bgGrad.addColorStop(0.5, '#0C0A04');
      bgGrad.addColorStop(1, '#040404');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Subtle perspective cyber-gold grid
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.07)';
      ctx.lineWidth = 1;
      const spacing = 64;
      const offset = (t * 18) % spacing;
      for (let x = 0; x < w; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = offset; y < h; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Floating obsidian & yellow tarot/arcade cards
      for (const c of floatingCards) {
        c.x = (c.x + c.vx * 0.016 + w) % w;
        c.y = (c.y + c.vy * 0.016 + h) % h;
        c.angle += c.vAngle * 0.016;

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.angle);
        ctx.globalAlpha = 0.24;
        ctx.fillStyle = '#0A0A0A';
        ctx.strokeStyle = c.isBright ? '#FACC15' : '#CA8A04';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(-32, -46, 64, 92, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = c.isBright ? '#FDE047' : '#EAB308';
        ctx.font = '600 13px "JetBrains Mono", monospace';
        ctx.fillText(c.rank, -22, -24);
        ctx.font = '22px serif';
        ctx.fillText(c.suit, -9, 10);
        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col justify-between p-8 md:p-12 select-none bg-[#050505] text-yellow-50">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Top Perimeter Low-Occlusion Cluster */}
      <div className="relative z-10 flex items-center justify-between text-xs text-yellow-200/70">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-yellow-100">{playerHandle}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums text-yellow-400 font-semibold">{bankroll.toLocaleString()} Chips</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{peerCount} P2P Nodes</span>
        </div>
        <div className="flex items-center gap-3 font-mono tabular-nums text-yellow-200/70">
          <span>Wasm 64KB Linear Heap</span>
          <span aria-hidden="true">·</span>
          <span>AES-256-GCM</span>
        </div>
      </div>

      {/* Centerpiece Bespoke Black & Yellow SVG Lockup */}
      <div className="relative z-10 max-w-3xl mx-auto text-center flex flex-col items-center my-auto py-12">
        <svg
          viewBox="0 0 560 130"
          className="w-full max-w-xl h-auto mb-6"
          role="img"
          aria-label="AetherDeck Decentralized P2P GamePlayer"
        >
          <defs>
            <linearGradient id="crestGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="50%" stopColor="#FACC15" />
              <stop offset="100%" stopColor="#CA8A04" />
            </linearGradient>
          </defs>
          {/* Central Ace & Hexagon Emblem */}
          <polygon
            points="280,8 314,26 314,64 280,82 246,64 246,26"
            fill="#0A0A0A"
            stroke="url(#crestGold)"
            strokeWidth="2.5"
          />
          <path
            d="M280 24 C270 38, 258 44, 258 53 C258 59, 263 63, 269 63 C273 63, 276 61, 278 58 L274 70 L286 70 L282 58 C284 61, 287 63, 291 63 C297 63, 302 59, 302 53 C302 44, 290 38, 280 24 Z"
            fill="url(#crestGold)"
          />
          <line x1="60" y1="45" x2="226" y2="45" stroke="#422006" strokeWidth="1.5" />
          <line x1="334" y1="45" x2="500" y2="45" stroke="#422006" strokeWidth="1.5" />
          <text
            x="280"
            y="114"
            textAnchor="middle"
            fill="#FACC15"
            fontFamily="Cinzel, Georgia, serif"
            fontWeight="700"
            fontSize="34"
            letterSpacing="6"
          >
            AETHERDECK
          </text>
        </svg>

        <p className="text-yellow-100/80 text-base md:text-lg max-w-xl mb-8 leading-relaxed">
          Obsidian &amp; Gold Offline-First Card Tables, Astrology Tarot Oracle, Classical Board Arena, and 60fps WebAssembly Retro Arcade.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => {
              nativeBridge.playSfx('victory');
              onEnterArena('cards');
            }}
            className="px-7 py-3.5 text-sm font-bold text-black bg-yellow-400 hover:bg-yellow-300 rounded-xl shadow-[0_0_24px_rgba(250,204,21,0.35)] transition-transform active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Enter GamePlayer Arena (Enter)
          </button>
          <button
            type="button"
            onClick={() => {
              nativeBridge.playSfx('move');
              onEnterArena('emulator');
            }}
            className="px-5 py-3.5 text-sm font-semibold text-yellow-300 bg-[#111111] hover:bg-[#1A180D] border border-yellow-500/40 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Launch Wasm Emulator
          </button>
        </div>

        {/* Quick Mode Launchers */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-yellow-200/70">
          <button
            type="button"
            onClick={() => onEnterArena('cards')}
            className="hover:text-yellow-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            01. Card Games (Solitaire · 5-Card Poker · Hold’em · Blackjack · UNO · Tarot)
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => onEnterArena('boards')}
            className="hover:text-yellow-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            02. Board Games (Chess · Checkers · Reversi · Corridor · Shogi · Go · Sudoku)
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => onEnterArena('profile')}
            className="hover:text-yellow-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            03. Leaderboard &amp; Crypto Ledger
          </button>
        </div>
      </div>

      {/* Single flat control-hint line at bottom */}
      <div className="relative z-10 text-center text-xs font-mono text-yellow-200/60">
        WASD Move · Space Action · Enter Start · Esc Pause / Title Shell
      </div>
    </div>
  );
};
