import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Lock, Sparkles, RotateCw } from 'lucide-react';

export interface CardKeywordTooltip {
  term: string;
  definition: string;
}

export interface InspectableCardPayload {
  id: string;
  title: string;
  subtitle: string;
  suitOrColor: string;
  rankOrBadge: string;
  isRed?: boolean;
  unoColor?: 'R' | 'G' | 'B' | 'Y' | 'W';
  description: string;
  keywords: CardKeywordTooltip[];
  statusLabel?: string;
}

export type TactileCardSize = 'sm' | 'md' | 'lg';

export interface TactilePlayingCardProps {
  id: string;
  rank: string;
  suit: '♠' | '♥' | '♦' | '♣';
  faceUp?: boolean;
  size?: TactileCardSize;
  dealIndex?: number;
  fanAngle?: number;
  arcOffsetY?: number;
  isPlayable?: boolean;
  isComboHighlight?: boolean;
  isSelected?: boolean;
  isHeld?: boolean;
  isTapped?: boolean;
  isDimmed?: boolean;
  statusBadge?: string;
  dropPayload?: string;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onDropToSlot?: (slotId: string, cardId: string) => void;
  onDragVectorChange?: (vector: { startX: number; startY: number; curX: number; curY: number; hoveredSlotId: string | null } | null) => void;
  onInspect?: (payload: InspectableCardPayload, anchor: { x: number; y: number }) => void;
  inspectPayload?: InspectableCardPayload;
}

const SIZE_CLASSES: Record<TactileCardSize, string> = {
  sm: 'w-[70px] h-[102px] sm:w-[90px] sm:h-[130px]',
  md: 'w-[84px] h-[122px] sm:w-[106px] sm:h-[154px]',
  lg: 'w-[96px] h-[138px] sm:w-[118px] sm:h-[172px]',
};

export const TactilePlayingCard: React.FC<TactilePlayingCardProps> = ({
  id,
  rank,
  suit,
  faceUp = true,
  size = 'md',
  dealIndex = 0,
  fanAngle = 0,
  arcOffsetY = 0,
  isPlayable = false,
  isComboHighlight = false,
  isSelected = false,
  isHeld = false,
  isTapped = false,
  isDimmed = false,
  statusBadge,
  onClick,
  onDoubleClick,
  onDropToSlot,
  onDragVectorChange,
  onInspect,
  inspectPayload,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState<{ rx: number; ry: number }>({ rx: 0, ry: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const lastPointerRef = useRef<{ x: number; y: number; t: number }>({ x: 0, y: 0, t: 0 });
  const longPressTimerRef = useRef<number | null>(null);

  const isRed = suit === '♥' || suit === '♦';

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
    const relY = (e.clientY - rect.top) / Math.max(1, rect.height) - 0.5;

    const now = performance.now();
    const dt = Math.max(16, now - lastPointerRef.current.t);
    const vx = (e.clientX - lastPointerRef.current.x) / dt;
    const vy = (e.clientY - lastPointerRef.current.y) / dt;
    lastPointerRef.current = { x: e.clientX, y: e.clientY, t: now };

    const pitch = Math.max(-18, Math.min(18, -relY * 22 - vy * 8));
    const roll = Math.max(-18, Math.min(18, relX * 22 + vx * 8));
    setTilt({ rx: pitch, ry: roll });

    if (isDragging && onDragVectorChange) {
      const hitEl = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const slotNode = hitEl?.closest('[data-drop-slot]') as HTMLElement | null;
      const slotId = slotNode?.getAttribute('data-drop-slot') || null;
      onDragVectorChange({
        startX: rect.left + rect.width / 2,
        startY: rect.top + rect.height / 2,
        curX: e.clientX,
        curY: e.clientY,
        hoveredSlotId: slotId,
      });
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    lastPointerRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (faceUp && inspectPayload && onInspect) {
      clearLongPress();
      const clientX = e.clientX;
      const clientY = e.clientY;
      longPressTimerRef.current = window.setTimeout(() => {
        onInspect(inspectPayload, { x: clientX, y: clientY });
      }, 460);
    }
    if (faceUp && onDropToSlot) {
      setIsDragging(true);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    clearLongPress();
    if (isDragging) {
      setIsDragging(false);
      onDragVectorChange?.(null);
      if (onDropToSlot) {
        const hitEl = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const slotNode = hitEl?.closest('[data-drop-slot]') as HTMLElement | null;
        const slotId = slotNode?.getAttribute('data-drop-slot');
        if (slotId) {
          onDropToSlot(slotId, id);
          setTilt({ rx: 0, ry: 0 });
          return;
        }
      }
    }
    setTilt({ rx: 0, ry: 0 });
  };

  const borderGlowClass = isSelected
    ? 'ring-2 ring-yellow-300 border-2 border-yellow-300 shadow-[0_0_28px_rgba(250,204,21,0.55)]'
    : isHeld
    ? 'ring-2 ring-amber-400 border-2 border-amber-300 shadow-[0_0_24px_rgba(245,158,11,0.45)]'
    : isComboHighlight
    ? 'border-2 border-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.42)]'
    : isPlayable
    ? 'border-2 border-yellow-400/90 shadow-[0_0_18px_rgba(250,204,21,0.3)]'
    : 'border border-yellow-500/40 shadow-xl';

  return (
    <motion.div
      ref={cardRef}
      layout="position"
      initial={{ opacity: 0, y: -42, x: -24, scale: 0.78 }}
      animate={{
        opacity: isDimmed ? 0.45 : 1,
        x: 0,
        y: isSelected || isHeld ? arcOffsetY - 14 : isHovered && faceUp ? arcOffsetY - 10 : arcOffsetY,
        rotateZ: isTapped ? 90 : isSelected ? 0 : fanAngle,
        scale: isSelected ? 1.06 : isHovered && faceUp ? 1.05 : 1,
      }}
      exit={{ opacity: 0, y: 36, scale: 0.72, rotateZ: 14 }}
      transition={{
        type: 'spring',
        stiffness: 360,
        damping: 26,
        delay: Math.min(0.45, dealIndex * 0.055),
      }}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => {
        clearLongPress();
        setIsHovered(false);
        if (!isDragging) {
          setTilt({ rx: 0, ry: 0 });
        }
      }}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onClick={() => {
        clearLongPress();
        onClick?.();
      }}
      onDoubleClick={onDoubleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`relative ${SIZE_CLASSES[size]} [perspective:1100px] select-none shrink-0 cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 rounded-2xl`}
    >
      {/* 3D Perspective Inner Card Swapping Back & Front at 90deg */}
      <motion.div
        animate={{
          rotateY: faceUp ? tilt.ry : 180 + tilt.ry,
          rotateX: tilt.rx,
        }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        className="relative w-full h-full [transform-style:preserve-3d]"
      >
        {/* FRONT FACE (0deg) */}
        <div
          className={`absolute inset-0 w-full h-full rounded-2xl bg-gradient-to-b from-[#19170F] via-[#12110B] to-[#0C0B07] p-2 sm:p-2.5 flex flex-col justify-between [backface-visibility:hidden] overflow-hidden ${borderGlowClass}`}
        >
          {/* Subtle Specular Highlight Sweep on Hover/Select */}
          {(isHovered || isSelected || isComboHighlight) && (
            <motion.div
              initial={{ x: '-120%', opacity: 0 }}
              animate={{ x: '140%', opacity: [0, 0.28, 0] }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-y-0 w-12 -skew-x-12 bg-gradient-to-r from-transparent via-yellow-200/40 to-transparent"
            />
          )}

          {/* Top Corner Rank & Suit */}
          <div
            className={`flex items-start justify-between w-full leading-none font-mono font-bold tabular-nums ${
              isRed ? 'text-amber-400' : 'text-yellow-50'
            }`}
          >
            <div className="flex flex-col items-center leading-none">
              <span className="text-base sm:text-xl tracking-tight">{rank}</span>
              <span className="text-sm sm:text-base mt-0.5">{suit}</span>
            </div>

            {/* Quick Inspect Loupe Button (Desktop Hover or Touch Tap) */}
            {faceUp && inspectPayload && onInspect && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  onInspect(inspectPayload, { x: rect.left, y: rect.top });
                }}
                title="Inspect Card & Keywords"
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-black/55 hover:bg-yellow-400 hover:text-black text-yellow-300/85 border border-yellow-500/30 flex items-center justify-center transition-colors"
              >
                <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            )}
          </div>

          {/* Central Oversized Suit Emblem */}
          <div
            className={`self-center text-3xl sm:text-5xl leading-none drop-shadow-[0_2px_10px_rgba(250,204,21,0.18)] ${
              isRed ? 'text-amber-400' : 'text-yellow-200'
            }`}
          >
            {suit}
          </div>

          {/* Bottom Inverted Index / Status Badge */}
          <div className="flex items-end justify-between w-full leading-none">
            {isHeld ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-yellow-400 text-black font-mono text-[10px] sm:text-xs font-bold">
                <Lock className="w-2.5 h-2.5" />
                HOLD
              </span>
            ) : statusBadge ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/50 text-amber-200 font-mono text-[10px] font-bold truncate max-w-[68px]">
                {statusBadge}
              </span>
            ) : (
              <span />
            )}

            <div
              className={`font-mono font-bold text-sm sm:text-base tabular-nums ${
                isRed ? 'text-amber-400' : 'text-yellow-50'
              }`}
            >
              {rank}
              {suit}
            </div>
          </div>
        </div>

        {/* BACK FACE (180deg) */}
        <div className="absolute inset-0 w-full h-full rounded-2xl bg-[#090805] border-2 border-yellow-500/55 p-2 flex items-center justify-center shadow-xl [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="w-full h-full rounded-xl border border-yellow-400/35 bg-[radial-gradient(circle_at_center,_rgba(250,204,21,0.16)_0%,_rgba(12,10,6,0.95)_75%)] flex flex-col items-center justify-center">
            <svg viewBox="0 0 64 88" className="w-10 h-14 sm:w-12 sm:h-16 text-yellow-400/80">
              <polygon
                points="32,8 54,44 32,80 10,44"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle cx="32" cy="44" r="9" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export interface TactileUnoCardProps {
  id: string;
  color: 'R' | 'G' | 'B' | 'Y' | 'W';
  label: string;
  size?: TactileCardSize;
  dealIndex?: number;
  fanAngle?: number;
  arcOffsetY?: number;
  isPlayable?: boolean;
  isSelected?: boolean;
  isMulliganMarked?: boolean;
  onClick?: () => void;
  onInspect?: (payload: InspectableCardPayload, anchor: { x: number; y: number }) => void;
}

const UNO_SURFACE_THEMES: Record<'R' | 'G' | 'B' | 'Y' | 'W', string> = {
  R: 'from-rose-600 via-rose-700 to-rose-900 text-white border-rose-300',
  G: 'from-emerald-600 via-emerald-700 to-emerald-900 text-white border-emerald-300',
  B: 'from-sky-600 via-sky-700 to-sky-900 text-white border-sky-300',
  Y: 'from-yellow-300 via-yellow-400 to-amber-500 text-black border-yellow-100',
  W: 'from-[#1B180C] via-[#0D0C07] to-[#050504] text-yellow-300 border-yellow-400',
};

const UNO_COLOR_NAMES: Record<'R' | 'G' | 'B' | 'Y' | 'W', string> = {
  R: 'Crimson',
  G: 'Jade',
  B: 'Cobalt',
  Y: 'Solar Gold',
  W: 'Wild Prismatic',
};

export const TactileUnoCard: React.FC<TactileUnoCardProps> = ({
  id,
  color,
  label,
  size = 'md',
  dealIndex = 0,
  fanAngle = 0,
  arcOffsetY = 0,
  isPlayable = false,
  isSelected = false,
  isMulliganMarked = false,
  onClick,
  onInspect,
}) => {
  const [hovered, setHovered] = useState(false);

  const inspectData: InspectableCardPayload = {
    id,
    title: `${UNO_COLOR_NAMES[color]} ${label}`,
    subtitle: color === 'W' ? 'Universal Wild Action Card' : `UNO ${UNO_COLOR_NAMES[color]} Suit`,
    suitOrColor: UNO_COLOR_NAMES[color],
    rankOrBadge: label,
    unoColor: color,
    description:
      color === 'W'
        ? label === '+4'
          ? 'Forces rival peer to draw 4 cards immediately and lets you lock any active suit color.'
          : 'Playable over any card to command the next active suit color.'
        : label === 'Skip' || label === 'Reverse'
        ? 'Skips the opponent peer in 1v1 play so you chain another immediate action.'
        : label === '+2'
        ? 'Forces the opponent peer to draw 2 penalty cards.'
        : `Playable over any ${UNO_COLOR_NAMES[color]} card or any ${label} rank.`,
    keywords:
      label === '+4'
        ? [
            { term: 'Chain Penalty (+4)', definition: 'Adds 4 cards to the opposing hand from the draw stock.' },
            { term: 'Wild Suit Shift', definition: 'Overrides the current table color to your chosen suit.' },
          ]
        : label === 'Skip' || label === 'Reverse'
        ? [{ term: 'Tempo Chain', definition: 'In 2-player duels, Skip & Reverse immediately return priority to you.' }]
        : [{ term: 'Color / Symbol Match', definition: 'Playable whenever suit color or center symbol matches the top discard.' }],
  };

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 35, scale: 0.8 }}
      animate={{
        opacity: isPlayable || isMulliganMarked ? 1 : 0.55,
        y: isSelected || isMulliganMarked ? arcOffsetY - 16 : hovered && isPlayable ? arcOffsetY - 12 : arcOffsetY,
        rotateZ: isSelected ? 0 : fanAngle,
        scale: isSelected || isMulliganMarked ? 1.07 : hovered && isPlayable ? 1.05 : 1,
      }}
      exit={{ opacity: 0, y: -40, scale: 0.75 }}
      transition={{ type: 'spring', stiffness: 360, damping: 25, delay: Math.min(0.4, dealIndex * 0.045) }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`relative ${SIZE_CLASSES[size]} rounded-2xl bg-gradient-to-b ${UNO_SURFACE_THEMES[color]} p-2.5 flex flex-col justify-between select-none shrink-0 cursor-pointer touch-manipulation ${
        isMulliganMarked
          ? 'ring-2 ring-rose-400 border-2 shadow-[0_0_25px_rgba(251,113,133,0.55)]'
          : isPlayable
          ? 'border-2 shadow-[0_0_22px_rgba(250,204,21,0.4)] ring-1 ring-yellow-300/70'
          : 'border opacity-60'
      }`}
    >
      <div className="flex items-center justify-between text-xs sm:text-sm font-mono font-bold leading-none">
        <span>{label}</span>
        {onInspect && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const r = e.currentTarget.getBoundingClientRect();
              onInspect(inspectData, { x: r.left, y: r.top });
            }}
            className="w-6 h-6 rounded-md bg-black/35 hover:bg-black/65 text-yellow-100 flex items-center justify-center"
            title="Inspect Card"
          >
            <Search className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="my-auto self-center w-14 h-18 sm:w-16 sm:h-22 rounded-full border-2 border-current/40 bg-black/20 flex items-center justify-center -rotate-12">
        <span className="text-xl sm:text-2xl font-display font-bold tracking-tight rotate-12">
          {label}
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] sm:text-xs font-mono font-bold leading-none">
        <span>
          {isMulliganMarked ? 'REDRAW' : isPlayable ? 'PLAYABLE' : UNO_COLOR_NAMES[color].split(' ')[0]}
        </span>
        <span>{label}</span>
      </div>
    </motion.div>
  );
};

/**
 * Spring-Physics Fanned Hand Container:
 * Arranges child cards along a gentle arc and dynamically spreads neighbors on hover/focus.
 */
export const FannedCardHand: React.FC<{
  count: number;
  renderCard: (index: number, fanAngle: number, arcOffsetY: number) => React.ReactNode;
  compactMobileScroll?: boolean;
}> = ({ count, renderCard, compactMobileScroll = true }) => {
  const mid = (count - 1) / 2;
  const maxStepAngle = count <= 5 ? 4.2 : count <= 8 ? 3.0 : 2.1;

  return (
    <div
      className={`w-full flex items-end justify-start sm:justify-center py-3 px-3 ${
        compactMobileScroll ? 'overflow-x-auto no-scrollbar' : 'flex-wrap'
      }`}
    >
      <div className="flex items-end justify-center mx-auto">
        <AnimatePresence mode="popLayout">
          {Array.from({ length: count }).map((_, idx) => {
            const rel = idx - mid;
            const fanAngle = rel * maxStepAngle;
            const arcOffsetY = Math.abs(rel) * Math.abs(rel) * 1.8;
            return (
              <div
                key={idx}
                className={idx > 0 ? (count > 7 ? '-ml-5 sm:-ml-6' : '-ml-2 sm:-ml-3') : ''}
              >
                {renderCard(idx, fanAngle, arcOffsetY)}
              </div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

/**
 * Interactive Riffle-Shuffle & Recycle Deck Pile
 */
export const TactileDeckStock: React.FC<{
  count: number;
  label?: string;
  sublabel?: string;
  isShuffling?: boolean;
  onDraw?: () => void;
  onInspectPile?: () => void;
  size?: TactileCardSize;
}> = ({
  count,
  label = 'STOCK',
  sublabel,
  isShuffling = false,
  onDraw,
  onInspectPile,
  size = 'md',
}) => {
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div className="flex items-center gap-1.5 text-xs font-mono text-yellow-300 font-bold tabular-nums">
        <span>
          {label} ({count})
        </span>
        {onInspectPile && (
          <button
            type="button"
            onClick={onInspectPile}
            className="px-1.5 py-0.5 rounded bg-[#18160D] hover:bg-yellow-400 hover:text-black text-yellow-300 border border-yellow-500/35 text-[10px] cursor-pointer transition-colors"
            title="Inspect Deck Composition"
          >
            Browse
          </button>
        )}
      </div>

      <div className="relative">
        {/* Stacked Deck Depth Layers */}
        {count > 2 && (
          <motion.div
            animate={
              isShuffling
                ? { x: [-8, 10, -5, 0], rotateZ: [-5, 6, -3, 0] }
                : { x: 4, y: 4, rotateZ: 0 }
            }
            transition={{ duration: 0.42 }}
            className={`absolute inset-0 ${SIZE_CLASSES[size]} rounded-2xl bg-[#070604] border border-yellow-500/35 pointer-events-none`}
          />
        )}
        {count > 1 && (
          <motion.div
            animate={
              isShuffling
                ? { x: [9, -9, 6, 0], rotateZ: [5, -6, 3, 0] }
                : { x: 2, y: 2, rotateZ: 0 }
            }
            transition={{ duration: 0.42 }}
            className={`absolute inset-0 ${SIZE_CLASSES[size]} rounded-2xl bg-[#0A0906] border border-yellow-500/45 pointer-events-none`}
          />
        )}

        <motion.button
          type="button"
          whileHover={{ scale: 1.03, y: -3 }}
          whileTap={{ scale: 0.96 }}
          onClick={onDraw}
          className={`relative ${SIZE_CLASSES[size]} rounded-2xl bg-[#0D0B07] hover:bg-[#17140B] border-2 ${
            count > 0 ? 'border-yellow-400/75 shadow-[0_0_20px_rgba(250,204,21,0.18)]' : 'border-dashed border-yellow-500/45'
          } flex flex-col items-center justify-center gap-1.5 text-yellow-300 font-mono cursor-pointer touch-manipulation`}
        >
          {count > 0 ? (
            <>
              <Sparkles className="w-5 h-5 text-yellow-400" />
              <span className="text-xs sm:text-sm font-bold tracking-wider">DRAW</span>
              {sublabel && <span className="text-[10px] text-yellow-200/80">{sublabel}</span>}
            </>
          ) : (
            <>
              <RotateCw className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-bold text-amber-300">RECYCLE</span>
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
};
