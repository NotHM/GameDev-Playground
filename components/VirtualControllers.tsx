// Pillar 2: Components — Complete Multi-Layout Virtual Controller Suite
// Supports:
// 1. SNES / 16-Bit Retro Cross Pad (D-Pad + L/R + Select/Start + ABXY Diamond)
// 2. Arcade 8-Way Fight Stick (8-Way Stick + 6-Button Street Layout)
// 3. Dual-Analog Thumbstick Controller (Left/Right Analog Sticks + Triggers)
// 4. Rotary Paddle & Spinner Dial (Angular Dial for Breakout/Vector + Fire)
// 5. Compact Handheld Touch Bar (Low-Occlusion Mobile Ergonomic Bar)

import React, { useState } from 'react';
import { nativeBridge } from '../app/nativeBindings.ts';

export type VirtualControllerType =
  | 'snes_16bit'
  | 'arcade_fightstick'
  | 'dual_analog'
  | 'rotary_paddle'
  | 'handheld_compact';

export interface VirtualControllerSpec {
  id: VirtualControllerType;
  name: string;
  era: string;
  description: string;
}

export const VIRTUAL_CONTROLLER_SPECS: VirtualControllerSpec[] = [
  {
    id: 'snes_16bit',
    name: '16-Bit SNES Cross Pad',
    era: '1990 16-Bit Console',
    description: 'Tactile cross D-Pad, L/R shoulder bumpers, Select/Start, and 4-color ABXY diamond.',
  },
  {
    id: 'arcade_fightstick',
    name: 'Arcade 8-Way Fight Stick',
    era: '1991 Cabinet Sanwa Layout',
    description: '8-way microswitch ball-top joystick with 6-button arcade street matrix (LP/MP/HP/LK/MK/HK).',
  },
  {
    id: 'dual_analog',
    name: 'Dual-Analog Pro Pad',
    era: 'Modern Handheld / Console',
    description: 'Twin 360-degree analog thumbsticks with L1/L2/R1/R2 shoulder triggers.',
  },
  {
    id: 'rotary_paddle',
    name: 'Rotary Paddle & Spinner Dial',
    era: '1981 Vector / Brick-Breaker',
    description: 'High-precision angular spinner dial for Breakout, Arkanoid, and vector turret rotation.',
  },
  {
    id: 'handheld_compact',
    name: 'Compact Handheld Touch Bar',
    era: 'Pocket Linux / Mobile',
    description: 'Low-profile thumb bar engineered for fast single-line input.',
  },
];

interface VirtualControllersProps {
  activeController: VirtualControllerType;
  onSelectController: (type: VirtualControllerType) => void;
  onActionKey: (code: string, isDown: boolean) => void;
  onResetRom?: () => void;
}

export const VirtualControllerDeck: React.FC<VirtualControllersProps> = ({
  activeController,
  onSelectController,
  onActionKey,
  onResetRom,
}) => {
  const [rotaryAngle, setRotaryAngle] = useState<number>(0);
  const [leftStickPos, setLeftStickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rightStickPos, setRightStickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeButtons, setActiveButtons] = useState<Record<string, boolean>>({});

  const pressKey = (code: string, down: boolean, label?: string) => {
    setActiveButtons((prev) => ({ ...prev, [label || code]: down }));
    onActionKey(code, down);
    if (down) {
      nativeBridge.playSfx('move');
    }
  };

  const handleRotaryStep = (deltaDeg: number) => {
    const next = Math.max(-135, Math.min(135, rotaryAngle + deltaDeg));
    setRotaryAngle(next);
    const code = deltaDeg < 0 ? 'ArrowLeft' : 'ArrowRight';
    onActionKey(code, true);
    window.setTimeout(() => onActionKey(code, false), 95);
    nativeBridge.playSfx('move');
  };

  const nudgeAnalogStick = (stick: 'left' | 'right', dx: number, dy: number, code: string) => {
    if (stick === 'left') {
      setLeftStickPos({ x: dx * 18, y: dy * 18 });
      window.setTimeout(() => setLeftStickPos({ x: 0, y: 0 }), 160);
    } else {
      setRightStickPos({ x: dx * 18, y: dy * 18 });
      window.setTimeout(() => setRightStickPos({ x: 0, y: 0 }), 160);
    }
    onActionKey(code, true);
    window.setTimeout(() => onActionKey(code, false), 140);
    nativeBridge.playSfx('move');
  };

  return (
    <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-4 select-none">
      {/* Controller Model Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <div className="text-xs font-semibold text-slate-200">Virtual Hardware Controller Bus</div>
          <div className="text-[11px] text-slate-400">
            {VIRTUAL_CONTROLLER_SPECS.find((c) => c.id === activeController)?.description}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          {VIRTUAL_CONTROLLER_SPECS.map((spec) => (
            <button
              key={spec.id}
              type="button"
              onClick={() => {
                nativeBridge.playSfx('card');
                onSelectController(spec.id);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeController === spec.id
                  ? 'bg-emerald-400 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {spec.name}
            </button>
          ))}
        </div>
      </div>

      {/* 1. SNES 16-BIT RETRO CROSS PAD */}
      {activeController === 'snes_16bit' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
          {/* L & R Bumpers */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onPointerDown={() => pressKey('KeyA', true, 'L')}
              onPointerUp={() => pressKey('KeyA', false, 'L')}
              onPointerLeave={() => pressKey('KeyA', false, 'L')}
              className="px-6 py-1.5 text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 active:bg-emerald-500 active:text-slate-950 text-slate-300 border border-slate-700 rounded-t-xl cursor-pointer"
            >
              L SHOULDER
            </button>
            <span className="text-[11px] font-mono text-slate-500">SUPER 16-BIT CONTROLLER</span>
            <button
              type="button"
              onPointerDown={() => pressKey('KeyD', true, 'R')}
              onPointerUp={() => pressKey('KeyD', false, 'R')}
              onPointerLeave={() => pressKey('KeyD', false, 'R')}
              className="px-6 py-1.5 text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 active:bg-emerald-500 active:text-slate-950 text-slate-300 border border-slate-700 rounded-t-xl cursor-pointer"
            >
              R SHOULDER
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-6">
            {/* Cross D-Pad */}
            <div className="flex justify-center">
              <div className="grid grid-cols-3 gap-1.5 w-36 h-36 p-2 bg-slate-950 rounded-full border border-slate-800 items-center justify-items-center">
                <div />
                <button
                  type="button"
                  onPointerDown={() => pressKey('ArrowUp', true, 'UP')}
                  onPointerUp={() => pressKey('ArrowUp', false, 'UP')}
                  onPointerLeave={() => pressKey('ArrowUp', false, 'UP')}
                  className="w-10 h-10 bg-slate-800 hover:bg-slate-700 active:bg-emerald-400 active:text-slate-950 rounded-t-lg font-mono text-xs font-bold flex items-center justify-center cursor-pointer"
                >
                  ▲
                </button>
                <div />
                <button
                  type="button"
                  onPointerDown={() => pressKey('ArrowLeft', true, 'LEFT')}
                  onPointerUp={() => pressKey('ArrowLeft', false, 'LEFT')}
                  onPointerLeave={() => pressKey('ArrowLeft', false, 'LEFT')}
                  className="w-10 h-10 bg-slate-800 hover:bg-slate-700 active:bg-emerald-400 active:text-slate-950 rounded-l-lg font-mono text-xs font-bold flex items-center justify-center cursor-pointer"
                >
                  ◀
                </button>
                <div className="w-8 h-8 bg-slate-900 rounded-full border border-slate-800" />
                <button
                  type="button"
                  onPointerDown={() => pressKey('ArrowRight', true, 'RIGHT')}
                  onPointerUp={() => pressKey('ArrowRight', false, 'RIGHT')}
                  onPointerLeave={() => pressKey('ArrowRight', false, 'RIGHT')}
                  className="w-10 h-10 bg-slate-800 hover:bg-slate-700 active:bg-emerald-400 active:text-slate-950 rounded-r-lg font-mono text-xs font-bold flex items-center justify-center cursor-pointer"
                >
                  ▶
                </button>
                <div />
                <button
                  type="button"
                  onPointerDown={() => pressKey('ArrowDown', true, 'DOWN')}
                  onPointerUp={() => pressKey('ArrowDown', false, 'DOWN')}
                  onPointerLeave={() => pressKey('ArrowDown', false, 'DOWN')}
                  className="w-10 h-10 bg-slate-800 hover:bg-slate-700 active:bg-emerald-400 active:text-slate-950 rounded-b-lg font-mono text-xs font-bold flex items-center justify-center cursor-pointer"
                >
                  ▼
                </button>
                <div />
              </div>
            </div>

            {/* Select & Start */}
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => onResetRom?.()}
                className="px-3.5 py-1.5 text-[11px] font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-full -rotate-12 cursor-pointer"
              >
                SELECT (RESET)
              </button>
              <button
                type="button"
                onPointerDown={() => pressKey('Enter', true, 'START')}
                onPointerUp={() => pressKey('Enter', false, 'START')}
                className="px-3.5 py-1.5 text-[11px] font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-full -rotate-12 cursor-pointer"
              >
                START
              </button>
            </div>

            {/* ABXY 4-Color Action Diamond */}
            <div className="flex justify-center">
              <div className="grid grid-cols-3 gap-1.5 w-36 h-36 p-2 bg-slate-950 rounded-full border border-slate-800 items-center justify-items-center">
                <div />
                <button
                  type="button"
                  onPointerDown={() => pressKey('KeyW', true, 'X')}
                  onPointerUp={() => pressKey('KeyW', false, 'X')}
                  onPointerLeave={() => pressKey('KeyW', false, 'X')}
                  className="w-10 h-10 rounded-full bg-sky-500 hover:bg-sky-400 active:scale-95 text-slate-950 font-mono font-bold text-xs shadow cursor-pointer"
                >
                  X
                </button>
                <div />
                <button
                  type="button"
                  onPointerDown={() => pressKey('Space', true, 'Y')}
                  onPointerUp={() => pressKey('Space', false, 'Y')}
                  onPointerLeave={() => pressKey('Space', false, 'Y')}
                  className="w-10 h-10 rounded-full bg-emerald-400 hover:bg-emerald-300 active:scale-95 text-slate-950 font-mono font-bold text-xs shadow cursor-pointer"
                >
                  Y
                </button>
                <div />
                <button
                  type="button"
                  onPointerDown={() => pressKey('Space', true, 'A')}
                  onPointerUp={() => pressKey('Space', false, 'A')}
                  onPointerLeave={() => pressKey('Space', false, 'A')}
                  className="w-10 h-10 rounded-full bg-rose-500 hover:bg-rose-400 active:scale-95 text-white font-mono font-bold text-xs shadow cursor-pointer"
                >
                  A
                </button>
                <div />
                <button
                  type="button"
                  onPointerDown={() => pressKey('Space', true, 'B')}
                  onPointerUp={() => pressKey('Space', false, 'B')}
                  onPointerLeave={() => pressKey('Space', false, 'B')}
                  className="w-10 h-10 rounded-full bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-mono font-bold text-xs shadow cursor-pointer"
                >
                  B
                </button>
                <div />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. ARCADE 8-WAY FIGHT STICK */}
      {activeController === 'arcade_fightstick' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* 8-Way Joystick Gate */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">8-WAY SANWA OCTAGONAL GATE</span>
            <div className="grid grid-cols-3 gap-1.5 p-3 bg-slate-950 border border-slate-800 rounded-2xl">
              {[
                { label: '↖', codes: ['ArrowUp', 'ArrowLeft'] },
                { label: '↑', codes: ['ArrowUp'] },
                { label: '↗', codes: ['ArrowUp', 'ArrowRight'] },
                { label: '←', codes: ['ArrowLeft'] },
                { label: '●', codes: [] },
                { label: '→', codes: ['ArrowRight'] },
                { label: '↙', codes: ['ArrowDown', 'ArrowLeft'] },
                { label: '↓', codes: ['ArrowDown'] },
                { label: '↘', codes: ['ArrowDown', 'ArrowRight'] },
              ].map((dir, i) => (
                <button
                  key={i}
                  type="button"
                  onPointerDown={() => dir.codes.forEach((c) => pressKey(c, true))}
                  onPointerUp={() => dir.codes.forEach((c) => pressKey(c, false))}
                  onPointerLeave={() => dir.codes.forEach((c) => pressKey(c, false))}
                  className={`w-11 h-11 rounded-xl font-mono text-sm font-bold flex items-center justify-center cursor-pointer ${
                    dir.codes.length === 0
                      ? 'bg-rose-500 text-white shadow-inner'
                      : 'bg-slate-800 hover:bg-slate-700 active:bg-emerald-400 active:text-slate-950 text-slate-200'
                  }`}
                >
                  {dir.label}
                </button>
              ))}
            </div>
          </div>

          {/* 6-Button Arcade Street Layout */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">6-BUTTON ARCADE ACTION DECK</span>
            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              {[
                { id: 'LP', code: 'Space', color: 'bg-sky-500 text-slate-950' },
                { id: 'MP', code: 'KeyW', color: 'bg-amber-400 text-slate-950' },
                { id: 'HP', code: 'Enter', color: 'bg-rose-500 text-white' },
                { id: 'LK', code: 'ArrowLeft', color: 'bg-emerald-400 text-slate-950' },
                { id: 'MK', code: 'ArrowDown', color: 'bg-amber-300 text-slate-950' },
                { id: 'HK', code: 'ArrowRight', color: 'bg-rose-600 text-white' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onPointerDown={() => pressKey(btn.code, true, btn.id)}
                  onPointerUp={() => pressKey(btn.code, false, btn.id)}
                  onPointerLeave={() => pressKey(btn.code, false, btn.id)}
                  className={`w-14 h-14 rounded-full font-mono font-bold text-xs shadow-lg active:scale-95 transition-transform cursor-pointer ${btn.color}`}
                >
                  {btn.id}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. DUAL-ANALOG PRO THUMBSTICK PAD */}
      {activeController === 'dual_analog' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Left Analog Stick */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">LEFT ANALOG STICK (MOVE)</span>
            <div className="relative w-36 h-36 rounded-full bg-slate-950 border-2 border-slate-800 flex items-center justify-center">
              <div
                style={{ transform: `translate(${leftStickPos.x}px, ${leftStickPos.y}px)` }}
                className="w-14 h-14 rounded-full bg-emerald-500/30 border-2 border-emerald-400 flex items-center justify-center text-xs font-mono text-emerald-200 transition-transform"
              >
                L3
              </div>
              <button
                type="button"
                onClick={() => nudgeAnalogStick('left', 0, -1, 'ArrowUp')}
                className="absolute top-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => nudgeAnalogStick('left', 0, 1, 'ArrowDown')}
                className="absolute bottom-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                ▼
              </button>
              <button
                type="button"
                onClick={() => nudgeAnalogStick('left', -1, 0, 'ArrowLeft')}
                className="absolute left-2 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => nudgeAnalogStick('left', 1, 0, 'ArrowRight')}
                className="absolute right-2 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                ▶
              </button>
            </div>
          </div>

          {/* Center Triggers & Status */}
          <div className="flex flex-col items-center gap-3">
            <div className="grid grid-cols-2 gap-2 w-full">
              <button
                type="button"
                onPointerDown={() => pressKey('KeyA', true, 'L2')}
                onPointerUp={() => pressKey('KeyA', false, 'L2')}
                className="py-2 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl cursor-pointer"
              >
                L2 TRIGGER
              </button>
              <button
                type="button"
                onPointerDown={() => pressKey('Space', true, 'R2')}
                onPointerUp={() => pressKey('Space', false, 'R2')}
                className="py-2 text-xs font-mono bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold rounded-xl cursor-pointer"
              >
                R2 FIRE
              </button>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Active Signals: {Object.keys(activeButtons).filter((k) => activeButtons[k]).join(', ') || 'IDLE'}
            </div>
          </div>

          {/* Right Analog Stick */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">RIGHT ANALOG STICK (AIM / VECTOR)</span>
            <div className="relative w-36 h-36 rounded-full bg-slate-950 border-2 border-slate-800 flex items-center justify-center">
              <div
                style={{ transform: `translate(${rightStickPos.x}px, ${rightStickPos.y}px)` }}
                className="w-14 h-14 rounded-full bg-amber-500/30 border-2 border-amber-400 flex items-center justify-center text-xs font-mono text-amber-200 transition-transform"
              >
                R3
              </div>
              <button
                type="button"
                onClick={() => nudgeAnalogStick('right', 0, -1, 'KeyW')}
                className="absolute top-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => nudgeAnalogStick('right', 0, 1, 'KeyS')}
                className="absolute bottom-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                ▼
              </button>
              <button
                type="button"
                onClick={() => nudgeAnalogStick('right', -1, 0, 'KeyA')}
                className="absolute left-2 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => nudgeAnalogStick('right', 1, 0, 'KeyD')}
                className="absolute right-2 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                ▶
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. ROTARY PADDLE & SPINNER DIAL */}
      {activeController === 'rotary_paddle' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-around gap-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => handleRotaryStep(-25)}
              className="px-4 py-3 text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl cursor-pointer"
            >
              ↺ CCW (-25°)
            </button>

            <div className="relative w-28 h-28 rounded-full bg-slate-950 border-4 border-slate-700 flex items-center justify-center shadow-inner">
              <div
                style={{ transform: `rotate(${rotaryAngle}deg)` }}
                className="w-full h-full flex justify-center pt-2 transition-transform"
              >
                <div className="w-2.5 h-7 rounded-full bg-emerald-400" />
              </div>
              <span className="absolute text-xs font-mono text-slate-300">{rotaryAngle}°</span>
            </div>

            <button
              type="button"
              onClick={() => handleRotaryStep(25)}
              className="px-4 py-3 text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl cursor-pointer"
            >
              CW (+25°) ↻
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onPointerDown={() => pressKey('Space', true, 'LAUNCH')}
              onPointerUp={() => pressKey('Space', false, 'LAUNCH')}
              className="px-6 py-4 text-xs font-mono font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-2xl shadow-lg cursor-pointer"
            >
              PADDLE LAUNCH / FIRE (SPACE)
            </button>
          </div>
        </div>
      )}

      {/* 5. COMPACT HANDHELD TOUCH MATRIX */}
      {activeController === 'handheld_compact' && (
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-1.5">
            {[
              { label: '◀ Left', code: 'ArrowLeft' },
              { label: '▲ Up', code: 'ArrowUp' },
              { label: '▼ Down', code: 'ArrowDown' },
              { label: '▶ Right', code: 'ArrowRight' },
            ].map((btn) => (
              <button
                key={btn.code}
                type="button"
                onPointerDown={() => pressKey(btn.code, true)}
                onPointerUp={() => pressKey(btn.code, false)}
                onPointerLeave={() => pressKey(btn.code, false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 active:bg-emerald-900/60 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {btn.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onPointerDown={() => pressKey('KeyW', true)}
              onPointerUp={() => pressKey('KeyW', false)}
              className="px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Thrust / Boost (W)
            </button>
            <button
              type="button"
              onPointerDown={() => pressKey('Space', true)}
              onPointerUp={() => pressKey('Space', false)}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Action / Fire (Space)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
