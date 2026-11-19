import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  History,
  Layers,
  Flame,
  MessageSquare,
  X,
  CheckCircle2,
  RefreshCw,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { InspectableCardPayload } from './TactileCard.tsx';

export interface CardActionLogItem {
  id: string;
  actor: string;
  action: string;
  detail: string;
  deltaLabel?: string;
  timestamp: number;
}

export interface FloatingPopupItem {
  id: string;
  text: string;
  tone: 'gold' | 'amber' | 'rose' | 'neutral';
}

export interface ResolutionChainStep {
  id: string;
  stepNumber: number;
  label: string;
}

export interface BrowsablePileEntry {
  id: string;
  label: string;
  sublabel: string;
  accent?: 'red' | 'gold' | 'wild';
}

const QUICK_EMOTES = [
  'Well Played!',
  'Good Luck',
  'Thinking...',
  'Bold Raise!',
  'Nice Hand!',
];

/**
 * Dynamic Segmented Bezier Targeting Arrow & Reticle Overlay
 */
export const BezierTargetingOverlay: React.FC<{
  vector: {
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    hoveredSlotId: string | null;
  } | null;
}> = ({ vector }) => {
  if (!vector) return null;

  const { startX, startY, curX, curY, hoveredSlotId } = vector;
  const ctrlX = (startX + curX) / 2;
  const ctrlY = Math.min(startY, curY) - 85;
  const d = `M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${curX} ${curY}`;

  return (
    <svg className="fixed inset-0 w-screen h-screen pointer-events-none z-40 overflow-visible">
      <defs>
        <linearGradient id="tetherGold" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#CA8A04" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#FEF08A" stopOpacity="1" />
        </linearGradient>
      </defs>
      <path
        d={d}
        fill="none"
        stroke="url(#tetherGold)"
        strokeWidth={hoveredSlotId ? 4.5 : 3}
        strokeDasharray="10 6"
      />
      <circle
        cx={curX}
        cy={curY}
        r={hoveredSlotId ? 18 : 11}
        fill={hoveredSlotId ? 'rgba(250, 204, 21, 0.25)' : 'none'}
        stroke="#FACC15"
        strokeWidth="2.5"
      />
      <circle cx={curX} cy={curY} r="4" fill="#FEF08A" />
    </svg>
  );
};

/**
 * Opponent Hand Card-Back Arc, Real-Time Hover Telemetry & Emote Wheel
 */
export const OpponentArcHud: React.FC<{
  opponentName: string;
  cardCount: number;
  telemetryStatus: string;
  inspectedSlotIndex?: number | null;
  activePlayerEmote?: string | null;
  activeOpponentEmote?: string | null;
  onSendEmote: (emote: string) => void;
  revealedCardsNode?: React.ReactNode;
}> = ({
  opponentName,
  cardCount,
  telemetryStatus,
  inspectedSlotIndex = null,
  activePlayerEmote,
  activeOpponentEmote,
  onSendEmote,
  revealedCardsNode,
}) => {
  const [emoteMenuOpen, setEmoteMenuOpen] = useState(false);
  const clampedBacks = Math.min(10, Math.max(0, cardCount));
  const mid = (clampedBacks - 1) / 2;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-[#0D0C08]/95 border border-yellow-500/30">
      {/* Opponent Identity & Telemetry */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-[#19160B] border border-yellow-400/50 flex items-center justify-center font-display font-bold text-yellow-300 text-sm shrink-0">
          {opponentName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-yellow-100 truncate">
            <span>{opponentName}</span>
            <span aria-hidden="true" className="text-yellow-500/60">·</span>
            <span className="font-mono text-yellow-400 tabular-nums">{cardCount} Cards</span>
          </div>
          <div className="text-xs text-neutral-300 truncate">{telemetryStatus}</div>
        </div>

        <AnimatePresence>
          {activeOpponentEmote && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="px-3 py-1 rounded-xl bg-yellow-400 text-black font-bold text-xs shadow-lg whitespace-nowrap"
            >
              “{activeOpponentEmote}”
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Opponent Partial Card-Back Arc (or Revealed Showdown Cards) */}
      <div className="flex items-center justify-center">
        {revealedCardsNode ? (
          revealedCardsNode
        ) : (
          <div className="flex items-center py-1">
            {Array.from({ length: clampedBacks }).map((_, idx) => {
              const rel = idx - mid;
              const isOpponentHovering = inspectedSlotIndex === idx;
              return (
                <motion.div
                  key={idx}
                  animate={{
                    rotateZ: rel * -3.5,
                    y: isOpponentHovering ? 6 : -Math.abs(rel) * 1.4,
                  }}
                  className={`w-8 h-12 sm:w-10 sm:h-14 rounded-lg bg-[#090805] border ${
                    isOpponentHovering
                      ? 'border-yellow-300 ring-2 ring-yellow-400/70'
                      : 'border-yellow-500/45'
                  } ${idx > 0 ? '-ml-3.5 sm:-ml-4' : ''} flex items-center justify-center shadow-md`}
                >
                  <span className="text-[10px] text-yellow-500/70">★</span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Emote Wheel Trigger */}
      <div className="relative flex items-center gap-2">
        <AnimatePresence>
          {activePlayerEmote && (
            <motion.span
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs font-semibold text-yellow-300"
            >
              You: “{activePlayerEmote}”
            </motion.span>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setEmoteMenuOpen((v) => !v)}
          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#16140C] hover:bg-yellow-400 hover:text-black text-yellow-200 border border-yellow-500/35 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Emote</span>
        </button>

        <AnimatePresence>
          {emoteMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              className="absolute right-0 top-12 z-40 w-44 rounded-2xl bg-[#12100A] border border-yellow-400/60 p-2 shadow-2xl space-y-1"
            >
              {QUICK_EMOTES.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => {
                    onSendEmote(em);
                    setEmoteMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-yellow-100 hover:bg-yellow-400 hover:text-black transition-colors cursor-pointer"
                >
                  {em}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

/**
 * Phase & Turn Banner + Toggleable Burning "Rope" Countdown Timer + History/Pile Triggers
 */
export const PhaseAndRopeBar: React.FC<{
  phaseLabel: string;
  statusMessage: string;
  isCompetitiveMode: boolean;
  ropeEnabled: boolean;
  onToggleRope: () => void;
  ropeSecondsLeft: number;
  ropeMaxSeconds: number;
  actionLogCount: number;
  onOpenHistory: () => void;
  onOpenPileBrowser?: () => void;
}> = ({
  phaseLabel,
  statusMessage,
  isCompetitiveMode,
  ropeEnabled,
  onToggleRope,
  ropeSecondsLeft,
  ropeMaxSeconds,
  actionLogCount,
  onOpenHistory,
  onOpenPileBrowser,
}) => {
  const ratio = Math.max(0, Math.min(1, ropeSecondsLeft / Math.max(1, ropeMaxSeconds)));
  const isUrgent = ropeEnabled && isCompetitiveMode && ropeSecondsLeft <= 7;

  return (
    <div className="rounded-2xl bg-[#110F09] border border-yellow-500/30 px-4 py-2.5 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <motion.span
            key={phaseLabel}
            initial={{ scale: 0.9, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            className="px-2.5 py-1 rounded-lg bg-yellow-400 text-black font-display font-bold text-xs tracking-wider whitespace-nowrap shrink-0"
          >
            {phaseLabel}
          </motion.span>
          <span className="text-xs sm:text-sm font-medium text-yellow-50 truncate">
            {statusMessage}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isCompetitiveMode && (
            <button
              type="button"
              onClick={onToggleRope}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                ropeEnabled
                  ? isUrgent
                    ? 'bg-rose-950/70 text-rose-200 border-rose-400'
                    : 'bg-[#1D190C] text-yellow-300 border-yellow-400/60'
                  : 'bg-[#0C0B07] text-neutral-400 border-yellow-500/20 hover:text-yellow-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-yellow-400" />
              <span>{ropeEnabled ? `Rope ${ropeSecondsLeft}s` : 'Rope Off'}</span>
            </button>
          )}

          {onOpenPileBrowser && (
            <button
              type="button"
              onClick={onOpenPileBrowser}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#16140B] hover:bg-yellow-400 hover:text-black text-yellow-200 border border-yellow-500/35 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Piles</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenHistory}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#16140B] hover:bg-yellow-400 hover:text-black text-yellow-200 border border-yellow-500/35 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <History className="w-3.5 h-3.5" />
            <span>Log ({actionLogCount})</span>
          </button>
        </div>
      </div>

      {/* Burning Rope Countdown Bar */}
      {isCompetitiveMode && ropeEnabled && (
        <div className="w-full h-1.5 rounded-full bg-[#1C1910] overflow-hidden">
          <motion.div
            animate={{ scaleX: ratio }}
            transition={{ duration: 0.35, ease: 'linear' }}
            className={`origin-left h-full w-full ${
              isUrgent
                ? 'bg-gradient-to-r from-rose-600 via-amber-400 to-yellow-200'
                : 'bg-gradient-to-r from-amber-600 via-yellow-400 to-yellow-100'
            }`}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Floating Score/Impact Popups & Stack/Chain Resolution Staging Queue
 */
export const TableFeedbackLayer: React.FC<{
  popups: FloatingPopupItem[];
  chainSteps: ResolutionChainStep[];
}> = ({ popups, chainSteps }) => {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-24 z-40 flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {chainSteps.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-[#121009]/95 border border-yellow-400/70 shadow-[0_0_30px_rgba(250,204,21,0.28)]"
          >
            <span className="text-xs font-mono font-bold text-yellow-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              CHAIN RESOLUTION:
            </span>
            {chainSteps.map((st, idx) => (
              <React.Fragment key={st.id}>
                {idx > 0 && <span className="text-yellow-500/70 text-xs">→</span>}
                <span className="text-xs font-semibold text-yellow-100">
                  {st.stepNumber}. {st.label}
                </span>
              </React.Fragment>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {popups.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 18, scale: 0.82 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -22, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 24 }}
            className={`px-4 py-1.5 rounded-xl font-mono font-bold text-sm shadow-2xl border ${
              p.tone === 'rose'
                ? 'bg-rose-950/95 text-rose-200 border-rose-400'
                : p.tone === 'amber'
                ? 'bg-[#211807]/95 text-amber-300 border-amber-400'
                : 'bg-yellow-400 text-black border-yellow-200'
            }`}
          >
            {p.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

/**
 * Safe-Anchored Hover / Long-Press Card Zoom Preview with Nested Keyword Tooltips
 */
export const CardZoomInspectorOverlay: React.FC<{
  inspected: { payload: InspectableCardPayload; anchor: { x: number; y: number } } | null;
  onClose: () => void;
}> = ({ inspected, onClose }) => {
  const [viewport, setViewport] = useState({ w: 1280, h: 800 });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
  }, [inspected]);

  if (!inspected) return null;

  const { payload, anchor } = inspected;
  const isMobile = viewport.w < 640;
  const safeX = Math.max(16, Math.min(viewport.w - 340, anchor.x + 18));
  const safeY = Math.max(68, Math.min(viewport.h - 380, anchor.y - 40));

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end sm:block p-3 sm:p-0"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, x: isMobile ? 0 : safeX, y: isMobile ? 20 : safeY }}
        animate={{ opacity: 1, scale: 1, x: isMobile ? 0 : safeX, y: isMobile ? 0 : safeY }}
        exit={{ opacity: 0, scale: 0.92 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[320px] rounded-2xl bg-[#0D0C08] border-2 border-yellow-400 p-5 shadow-[0_0_45px_rgba(250,204,21,0.3)] space-y-4"
      >
        <div className="flex items-start justify-between gap-3 border-b border-yellow-500/25 pb-3">
          <div>
            <div className="text-xs font-mono text-yellow-400 font-bold">{payload.subtitle}</div>
            <h3 className="text-xl font-display font-bold text-yellow-50 mt-0.5">
              {payload.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] rounded-xl bg-[#1A180F] hover:bg-yellow-400 hover:text-black text-yellow-200 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Enlarged Card Emblem */}
        <div className="p-4 rounded-xl bg-[#15130B] border border-yellow-500/35 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs text-neutral-300">Suit / Domain</div>
            <div className="text-sm font-bold text-yellow-200">{payload.suitOrColor}</div>
          </div>
          <div
            className={`text-4xl font-mono font-bold ${
              payload.isRed ? 'text-amber-400' : 'text-yellow-300'
            }`}
          >
            {payload.rankOrBadge}
          </div>
        </div>

        <p className="text-sm text-yellow-50/95 leading-relaxed">{payload.description}</p>

        {/* Nested Keyword Tooltips */}
        {payload.keywords.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-yellow-500/20">
            <div className="text-xs font-mono text-yellow-400 font-bold flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Card Keywords &amp; Rules</span>
            </div>
            {payload.keywords.map((kw, i) => (
              <div
                key={i}
                className="p-2.5 rounded-xl bg-[#13110A] border border-yellow-500/20 space-y-0.5"
              >
                <div className="text-xs font-bold text-yellow-300">{kw.term}</div>
                <div className="text-xs text-neutral-300 leading-relaxed">{kw.definition}</div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

/**
 * Collapsible Chronological Action History Drawer
 */
export const ActionHistoryDrawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  entries: CardActionLogItem[];
}> = ({ isOpen, onClose, entries }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm h-full bg-[#0B0A07] border-l border-yellow-500/40 p-5 flex flex-col justify-between shadow-2xl"
          >
            <div className="flex items-center justify-between pb-4 border-b border-yellow-500/25">
              <div className="flex items-center gap-2 text-yellow-300 font-display font-bold text-base">
                <History className="w-4 h-4 text-yellow-400" />
                <span>Chronological Action Log</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="min-w-[40px] min-h-[40px] rounded-xl bg-[#16140C] hover:bg-yellow-400 hover:text-black text-yellow-200 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-2.5">
              {entries.length === 0 ? (
                <p className="text-sm text-neutral-400 text-center py-8">
                  No plays recorded yet in this session.
                </p>
              ) : (
                entries.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-[#13110A] border border-yellow-500/20 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-yellow-300">{item.actor}</span>
                      <span className="text-neutral-400 tabular-nums">
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-yellow-50">{item.action}</div>
                    <div className="flex items-center justify-between text-xs text-neutral-300">
                      <span>{item.detail}</span>
                      {item.deltaLabel && (
                        <span className="font-mono font-bold text-yellow-400">{item.deltaLabel}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};

/**
 * Pile Browser Modal (Discard / Waste / Foundations / Unspoiled Deck Composition)
 */
export const PileBrowserModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  piles: Array<{
    pileName: string;
    subtitle: string;
    items: BrowsablePileEntry[];
  }>;
}> = ({ isOpen, onClose, title, piles }) => {
  const [selectedPileIdx, setSelectedPileIdx] = useState(0);

  if (!isOpen) return null;
  const activePile = piles[Math.min(selectedPileIdx, Math.max(0, piles.length - 1))];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl bg-[#0C0B07] border-2 border-yellow-400/80 p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between border-b border-yellow-500/25 pb-3">
          <div>
            <h3 className="text-lg font-display font-bold text-yellow-300">{title}</h3>
            <p className="text-xs text-neutral-300">
              Inspect public discard/foundation stacks and remaining deck suit counts.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] rounded-xl bg-[#17150C] hover:bg-yellow-400 hover:text-black text-yellow-200 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {piles.map((p, idx) => (
            <button
              key={p.pileName}
              type="button"
              onClick={() => setSelectedPileIdx(idx)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                selectedPileIdx === idx
                  ? 'bg-yellow-400 text-black'
                  : 'bg-[#15130B] text-yellow-100 border border-yellow-500/25 hover:border-yellow-400'
              }`}
            >
              {p.pileName} ({p.items.length})
            </button>
          ))}
        </div>

        {activePile && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            <div className="text-xs text-neutral-300">{activePile.subtitle}</div>
            {activePile.items.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#121009] border border-yellow-500/20 text-center text-sm text-neutral-400">
                This pile is currently empty.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                {activePile.items.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 rounded-xl bg-[#14120A] border border-yellow-500/30 text-center space-y-0.5"
                  >
                    <div
                      className={`text-base font-mono font-bold ${
                        entry.accent === 'red' ? 'text-amber-400' : 'text-yellow-200'
                      }`}
                    >
                      {entry.label}
                    </div>
                    <div className="text-[11px] text-neutral-400 truncate">{entry.sublabel}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

/**
 * Interactive Opening-Hand Mulligan / Hold Redraw Banner
 */
export const MulliganBannerControl: React.FC<{
  title: string;
  subtitle: string;
  confirmLabel: string;
  keepAllLabel: string;
  selectedCount: number;
  onConfirm: () => void;
  onKeepAll: () => void;
}> = ({
  title,
  subtitle,
  confirmLabel,
  keepAllLabel,
  selectedCount,
  onConfirm,
  onKeepAll,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl bg-gradient-to-r from-[#1D190B] via-[#14120A] to-[#1D190B] border-2 border-yellow-400/75 flex flex-wrap items-center justify-between gap-4 shadow-xl"
    >
      <div className="space-y-0.5">
        <div className="text-sm font-display font-bold text-yellow-300 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-yellow-400" />
          <span>{title}</span>
        </div>
        <p className="text-xs sm:text-sm text-yellow-100/90">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md cursor-pointer transition-colors whitespace-nowrap"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>
            {confirmLabel} ({selectedCount})
          </span>
        </button>

        <button
          type="button"
          onClick={onKeepAll}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#17150C] hover:bg-[#242012] text-yellow-200 border border-yellow-500/40 font-semibold text-xs sm:text-sm cursor-pointer transition-colors whitespace-nowrap"
        >
          {keepAllLabel}
        </button>
      </div>
    </motion.div>
  );
};
