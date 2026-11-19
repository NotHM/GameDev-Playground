// Pillar 2: Components — Unified Input Mapper (Keyboard, Mouse, Touch & Bluetooth Gamepad)
import React, { useEffect, useState } from 'react';
import { ConnectedGamepadInfo, pollConnectedGamepads } from '../app/peripheralManager.ts';

interface InputMapperProps {
  onActionKey?: (code: string, isDown: boolean) => void;
}

const GAME_CONTROL_KEYS = new Set([
  'Space',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'Enter',
  'KeyR',
]);

export const useUnifiedInput = (onActionKey?: (code: string, isDown: boolean) => void) => {
  const [gamepads, setGamepads] = useState<ConnectedGamepadInfo[]>([]);
  const [lastInputSource, setLastInputSource] = useState<'Keyboard' | 'Gamepad' | 'Pointer'>('Keyboard');

  useEffect(() => {
    const isTextInput = (el: EventTarget | null): boolean => {
      const tag = (el as HTMLElement | null)?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTextInput(e.target)) return;

      // Prevent Spacebar and Arrow keys from scrolling the page or triggering a focused <button> click (fixes Asteroid Spacebar reset bug!)
      if (
        e.code === 'Space' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
        if (document.activeElement && (document.activeElement as HTMLElement).tagName === 'BUTTON') {
          (document.activeElement as HTMLElement).blur();
        }
      }

      if (GAME_CONTROL_KEYS.has(e.code)) {
        setLastInputSource('Keyboard');
      }
      onActionKey?.(e.code, true);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isTextInput(e.target)) return;
      if (
        e.code === 'Space' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      }
      onActionKey?.(e.code, false);
    };

    const handleBlur = () => {
      // Clear held keys on window blur
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].forEach((k) =>
        onActionKey?.(k, false)
      );
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp, { passive: false });
    window.addEventListener('blur', handleBlur);

    const pollInterval = window.setInterval(() => {
      const pads = pollConnectedGamepads();
      setGamepads(pads);
      if (pads.length > 0 && pads[0].buttonsPressed.length > 0) {
        setLastInputSource('Gamepad');
      }
    }, 120);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      clearInterval(pollInterval);
    };
  }, [onActionKey]);

  return { gamepads, lastInputSource };
};

export const VirtualDPadOverlay: React.FC<InputMapperProps> = ({ onActionKey }) => {
  const trigger = (code: string, down: boolean) => {
    onActionKey?.(code, down);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pt-3 select-none">
      <div className="flex items-center gap-1.5">
        {[
          { label: '◄ Left', code: 'ArrowLeft' },
          { label: '▲ Thrust / Up', code: 'ArrowUp' },
          { label: '▼ Down', code: 'ArrowDown' },
          { label: '► Right', code: 'ArrowRight' },
        ].map((btn) => (
          <button
            key={btn.code}
            type="button"
            onPointerDown={(e) => {
              e.currentTarget.blur();
              trigger(btn.code, true);
            }}
            onPointerUp={() => trigger(btn.code, false)}
            onPointerLeave={() => trigger(btn.code, false)}
            className="px-3.5 py-2 text-xs font-mono font-bold text-yellow-100 bg-[#12110B] hover:bg-[#1E1C10] active:bg-yellow-400 active:text-black border border-yellow-500/35 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {btn.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.currentTarget.blur();
            trigger('Space', true);
          }}
          onPointerUp={() => trigger('Space', false)}
          onPointerLeave={() => trigger('Space', false)}
          className="px-5 py-2 text-xs font-mono font-bold text-black bg-yellow-400 hover:bg-yellow-300 rounded-xl shadow-[0_0_15px_rgba(250,204,21,0.3)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          ★ Fire / Launch (Space)
        </button>
      </div>
    </div>
  );
};
