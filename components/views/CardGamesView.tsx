import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { nativeBridge } from '../../app/nativeBindings.ts';
import { MinimizableEscrowBar } from '../framework/MinimizableEscrowBar.tsx';
import { MinimizableTutorial } from '../framework/MinimizableTutorial.tsx';
import { GameWinMenuModal } from '../framework/GameWinMenuModal.tsx';
import { useP2PGameSync } from '../framework/useP2PGameSync.ts';
import {
  TactilePlayingCard,
  TactileUnoCard,
  FannedCardHand,
  TactileDeckStock,
  InspectableCardPayload,
} from '../framework/TactileCard.tsx';
import {
  BezierTargetingOverlay,
  OpponentArcHud,
  PhaseAndRopeBar,
  TableFeedbackLayer,
  CardZoomInspectorOverlay,
  ActionHistoryDrawer,
  PileBrowserModal,
  MulliganBannerControl,
  CardActionLogItem,
  FloatingPopupItem,
  ResolutionChainStep,
  BrowsablePileEntry,
} from '../framework/CardTableEngine.tsx';
import {
  Sparkles,
  RotateCcw,
  Compass,
  Sun,
  Moon,
  Star,
  Flame,
  Trophy,
  RefreshCw,
} from 'lucide-react';

export type CardGameMode =
  | 'solitaire'
  | 'draw_poker'
  | 'poker'
  | 'blackjack'
  | 'uno'
  | 'tarot';

export interface PlayingCard {
  id: string;
  suit: '♠' | '♥' | '♦' | '♣';
  rank: string;
  value: number; // Poker value (2..14)
  solitaireValue: number; // Solitaire value (A=1, 2=2..K=13)
  faceUp?: boolean;
}

export interface UnoCard {
  id: string;
  color: 'R' | 'G' | 'B' | 'Y' | 'W';
  label: string;
}

export type TarotElement = 'Fire' | 'Water' | 'Air' | 'Earth';

export interface RealTarotCard {
  id: string;
  arcana: 'Major' | 'Minor';
  number: number; // 0..21 for Major, 1..14 for Minor
  romanOrRank: string;
  name: string;
  suit?: 'Wands' | 'Cups' | 'Swords' | 'Pentacles';
  astrologyRuler: string;
  kabbalahPathOrDecan: string;
  numerologyNote: string;
  zodiacAffinity: string[];
  element: TarotElement;
  keywords: string[];
  uprightMeaning: string;
  reversedMeaning: string;
  celestialPower: number;
  isReversed?: boolean;
  revealed?: boolean;
}

interface CardGamesViewProps {
  bankroll: number;
  points: number;
  dailyPointsEarned: number;
  isP2PConnected: boolean;
  activeP2PPointBet: number;
  onPlaceP2PPointBet: (stake: number) => void;
  onCommitResult: (params: {
    gameType: string;
    summary: string;
    chipsDelta: number;
    outcome: 'win' | 'loss' | 'draw';
    statePayload: Record<string, unknown>;
  }) => void;
  onSyncP2PState: (gameType: string, state: Record<string, unknown>) => void;
  remoteRoomState?: Record<string, unknown>;
}

const CARD_GAME_TABS: Array<{ id: CardGameMode; label: string }> = [
  { id: 'solitaire', label: 'Klondike Solitaire' },
  { id: 'draw_poker', label: '5-Card Draw Poker' },
  { id: 'poker', label: 'Texas Hold’em' },
  { id: 'blackjack', label: 'Blackjack 21' },
  { id: 'uno', label: 'UNO Blitz' },
  { id: 'tarot', label: '★ Tarot & Astrology' },
];

const SUITS: Array<'♠' | '♥' | '♦' | '♣'> = ['♠', '♥', '♦', '♣'];
const SUIT_NAMES: Record<'♠' | '♥' | '♦' | '♣', string> = {
  '♠': 'Spades',
  '♥': 'Hearts',
  '♦': 'Diamonds',
  '♣': 'Clubs',
};

const RANKS = [
  { rank: 'A', value: 14, solitaireValue: 1 },
  { rank: '2', value: 2, solitaireValue: 2 },
  { rank: '3', value: 3, solitaireValue: 3 },
  { rank: '4', value: 4, solitaireValue: 4 },
  { rank: '5', value: 5, solitaireValue: 5 },
  { rank: '6', value: 6, solitaireValue: 6 },
  { rank: '7', value: 7, solitaireValue: 7 },
  { rank: '8', value: 8, solitaireValue: 8 },
  { rank: '9', value: 9, solitaireValue: 9 },
  { rank: '10', value: 10, solitaireValue: 10 },
  { rank: 'J', value: 11, solitaireValue: 11 },
  { rank: 'Q', value: 12, solitaireValue: 12 },
  { rank: 'K', value: 13, solitaireValue: 13 },
];

export const ZODIAC_SIGNS: Array<{
  sign: string;
  glyph: string;
  element: TarotElement;
  modality: 'Cardinal' | 'Fixed' | 'Mutable';
  ruler: string;
  dates: string;
}> = [
  { sign: 'Aries', glyph: '♈', element: 'Fire', modality: 'Cardinal', ruler: 'Mars', dates: 'Mar 21 – Apr 19' },
  { sign: 'Taurus', glyph: '♉', element: 'Earth', modality: 'Fixed', ruler: 'Venus', dates: 'Apr 20 – May 20' },
  { sign: 'Gemini', glyph: '♊', element: 'Air', modality: 'Mutable', ruler: 'Mercury', dates: 'May 21 – Jun 20' },
  { sign: 'Cancer', glyph: '♋', element: 'Water', modality: 'Cardinal', ruler: 'The Moon', dates: 'Jun 21 – Jul 22' },
  { sign: 'Leo', glyph: '♌', element: 'Fire', modality: 'Fixed', ruler: 'The Sun', dates: 'Jul 23 – Aug 22' },
  { sign: 'Virgo', glyph: '♍', element: 'Earth', modality: 'Mutable', ruler: 'Mercury', dates: 'Aug 23 – Sep 22' },
  { sign: 'Libra', glyph: '♎', element: 'Air', modality: 'Cardinal', ruler: 'Venus', dates: 'Sep 23 – Oct 22' },
  { sign: 'Scorpio', glyph: '♏', element: 'Water', modality: 'Fixed', ruler: 'Pluto & Mars', dates: 'Oct 23 – Nov 21' },
  { sign: 'Sagittarius', glyph: '♐', element: 'Fire', modality: 'Mutable', ruler: 'Jupiter', dates: 'Nov 22 – Dec 21' },
  { sign: 'Capricorn', glyph: '♑', element: 'Earth', modality: 'Cardinal', ruler: 'Saturn', dates: 'Dec 22 – Jan 19' },
  { sign: 'Aquarius', glyph: '♒', element: 'Air', modality: 'Fixed', ruler: 'Uranus & Saturn', dates: 'Jan 20 – Feb 18' },
  { sign: 'Pisces', glyph: '♓', element: 'Water', modality: 'Mutable', ruler: 'Neptune & Jupiter', dates: 'Feb 19 – Mar 20' },
];

export const TWELVE_ASTROLOGICAL_HOUSES: Array<{
  houseNum: string;
  title: string;
  naturalSign: string;
  naturalRuler: string;
  domain: string;
}> = [
  { houseNum: 'I', title: '1st House of Self & Ascendant', naturalSign: 'Aries', naturalRuler: 'Mars', domain: 'Identity, vitality & new beginnings' },
  { houseNum: 'II', title: '2nd House of Wealth & Values', naturalSign: 'Taurus', naturalRuler: 'Venus', domain: 'Material prosperity, craft & self-worth' },
  { houseNum: 'III', title: '3rd House of Mind & Voice', naturalSign: 'Gemini', naturalRuler: 'Mercury', domain: 'Intellect, communication & kindred bonds' },
  { houseNum: 'IV', title: '4th House of Sanctuary & Roots', naturalSign: 'Cancer', naturalRuler: 'The Moon', domain: 'Home, ancestry & emotional foundation' },
  { houseNum: 'V', title: '5th House of Creation & Joy', naturalSign: 'Leo', naturalRuler: 'The Sun', domain: 'Romance, artistry, play & bold expression' },
  { houseNum: 'VI', title: '6th House of Ritual & Craft', naturalSign: 'Virgo', naturalRuler: 'Mercury', domain: 'Daily devotion, mastery & holistic vitality' },
  { houseNum: 'VII', title: '7th House of Sacred Union', naturalSign: 'Libra', naturalRuler: 'Venus', domain: 'Partnerships, covenants & mirror souls' },
  { houseNum: 'VIII', title: '8th House of Alchemy & Depth', naturalSign: 'Scorpio', naturalRuler: 'Pluto', domain: 'Rebirth, shared power & esoteric mystery' },
  { houseNum: 'IX', title: '9th House of Philosophy & Quest', naturalSign: 'Sagittarius', naturalRuler: 'Jupiter', domain: 'Higher wisdom, prophecy & far horizons' },
  { houseNum: 'X', title: '10th House of Crown & Calling', naturalSign: 'Capricorn', naturalRuler: 'Saturn', domain: 'Public legacy, sovereignty & mastery' },
  { houseNum: 'XI', title: '11th House of Starlight & Allies', naturalSign: 'Aquarius', naturalRuler: 'Uranus', domain: 'Future vision, community & wishes fulfilled' },
  { houseNum: 'XII', title: '12th House of Dreams & Karma', naturalSign: 'Pisces', naturalRuler: 'Neptune', domain: 'Subconscious mysticism & soul completion' },
];

const MAJOR_ARCANA_DATA: Array<{
  number: number;
  roman: string;
  name: string;
  astrologyRuler: string;
  kabbalahPath: string;
  numerologyNote: string;
  zodiacAffinity: string[];
  element: TarotElement;
  keywords: string[];
  uprightMeaning: string;
  reversedMeaning: string;
}> = [
  {
    number: 0,
    roman: '0',
    name: 'The Fool',
    astrologyRuler: 'Uranus · Spirit of Air',
    kabbalahPath: '11th Path (Aleph א · Kether to Chokmah)',
    numerologyNote: '0 — Infinite Potential & Cosmic Egg',
    zodiacAffinity: ['Aquarius', 'Gemini', 'Libra'],
    element: 'Air',
    keywords: ['Beginnings', 'Leap of Faith', 'Innocence'],
    uprightMeaning: 'A sacred new cycle begins. Trust the cosmic wind and step boldly into uncharted territory with an open heart.',
    reversedMeaning: 'Hesitation at the precipice or reckless haste; pause to align your inner compass before leaping.',
  },
  {
    number: 1,
    roman: 'I',
    name: 'The Magician',
    astrologyRuler: 'Mercury · Messenger of Light',
    kabbalahPath: '12th Path (Beth ב · Kether to Binah)',
    numerologyNote: '1 — Focused Willpower & Conscious Initiation',
    zodiacAffinity: ['Gemini', 'Virgo'],
    element: 'Air',
    keywords: ['Manifestation', 'Alchemy', 'Willpower'],
    uprightMeaning: 'As above, so below. All four elemental tools lie on your altar—channel focused willpower into tangible reality.',
    reversedMeaning: 'Scattered focus or untapped talent; ground your intention before casting your next work.',
  },
  {
    number: 2,
    roman: 'II',
    name: 'The High Priestess',
    astrologyRuler: 'The Moon · Veil of Mysteries',
    kabbalahPath: '13th Path (Gimel ג · Kether to Tiphareth)',
    numerologyNote: '2 — Sacred Duality, Reflection & Inner Gnosis',
    zodiacAffinity: ['Cancer', 'Pisces'],
    element: 'Water',
    keywords: ['Intuition', 'Sacred Mystery', 'Subconscious'],
    uprightMeaning: 'Listen beneath the surface. Hidden wisdom, prophetic dreams, and lunar intuition guide your next step.',
    reversedMeaning: 'Ignoring your inner voice or seeking only surface answers; return to quiet contemplation.',
  },
  {
    number: 3,
    roman: 'III',
    name: 'The Empress',
    astrologyRuler: 'Venus · Sovereign of Abundance',
    kabbalahPath: '14th Path (Daleth ד · Chokmah to Binah)',
    numerologyNote: '3 — Creative Synthesis, Fertility & Flourishing',
    zodiacAffinity: ['Taurus', 'Libra'],
    element: 'Earth',
    keywords: ['Abundance', 'Creation', 'Sensory Harmony'],
    uprightMeaning: 'Fertile creativity and material flourishing surround you. Nurture your vision and receive prosperity.',
    reversedMeaning: 'Creative depletion or over-giving; replenish your own roots first.',
  },
  {
    number: 4,
    roman: 'IV',
    name: 'The Emperor',
    astrologyRuler: 'Aries · Throne of Mars',
    kabbalahPath: '15th Path (Heh ה · Chokmah to Tiphareth)',
    numerologyNote: '4 — Foundational Order, Architecture & Sovereignty',
    zodiacAffinity: ['Aries', 'Capricorn'],
    element: 'Fire',
    keywords: ['Sovereignty', 'Structure', 'Authority'],
    uprightMeaning: 'Establish unshakeable order, strategic discipline, and sovereign boundaries over your domain.',
    reversedMeaning: 'Rigidity or power struggles; lead through calm wisdom rather than force.',
  },
  {
    number: 5,
    roman: 'V',
    name: 'The Hierophant',
    astrologyRuler: 'Taurus · Earthly Lineage',
    kabbalahPath: '16th Path (Vav ו · Chokmah to Chesed)',
    numerologyNote: '5 — Sacred Transmission, Mentorship & Keys of Gnosis',
    zodiacAffinity: ['Taurus', 'Sagittarius'],
    element: 'Earth',
    keywords: ['Tradition', 'Initiation', 'Sacred Keys'],
    uprightMeaning: 'Seek mastery through time-tested wisdom, mentorship, and deeper philosophical foundations.',
    reversedMeaning: 'Breaking outdated dogma to forge your own authentic spiritual path.',
  },
  {
    number: 6,
    roman: 'VI',
    name: 'The Lovers',
    astrologyRuler: 'Gemini · Alchemical Union',
    kabbalahPath: '17th Path (Zayin ז · Binah to Tiphareth)',
    numerologyNote: '6 — Solar Harmony, Reciprocity & Wholehearted Choice',
    zodiacAffinity: ['Gemini', 'Libra'],
    element: 'Air',
    keywords: ['Alignment', 'Soul Union', 'Sacred Choice'],
    uprightMeaning: 'A fateful union of opposites and a choice made from wholehearted values bring magnetic harmony.',
    reversedMeaning: 'Inner conflict or misaligned priorities; reconcile heart and mind.',
  },
  {
    number: 7,
    roman: 'VII',
    name: 'The Chariot',
    astrologyRuler: 'Cancer · Celestial Armor',
    kabbalahPath: '18th Path (Cheth ח · Binah to Geburah)',
    numerologyNote: '7 — Directed Victory, Mastery & Dynamic Motion',
    zodiacAffinity: ['Cancer', 'Aries'],
    element: 'Water',
    keywords: ['Triumph', 'Momentum', 'Mastery'],
    uprightMeaning: 'Harness opposing forces under one unified will. Swift forward victory is assured.',
    reversedMeaning: 'Loss of direction or pulling against the tide; realign the reins.',
  },
  {
    number: 8,
    roman: 'VIII',
    name: 'Strength',
    astrologyRuler: 'Leo · Heart of the Sun',
    kabbalahPath: '19th Path (Teth ט · Chesed to Geburah)',
    numerologyNote: '8 — Infinite Lemniscate of Courage & Gentle Mastery',
    zodiacAffinity: ['Leo', 'Aries'],
    element: 'Fire',
    keywords: ['Courage', 'Compassion', 'Inner Fortitude'],
    uprightMeaning: 'True power tames the lion through calm radiance, fearless patience, and unbreakable grace.',
    reversedMeaning: 'Self-doubt or reactive impulse; remember the quiet fire within your heart.',
  },
  {
    number: 9,
    roman: 'IX',
    name: 'The Hermit',
    astrologyRuler: 'Virgo · Lantern of Truth',
    kabbalahPath: '20th Path (Yod י · Chesed to Tiphareth)',
    numerologyNote: '9 — Culminating Wisdom, Solitude & Inner Star',
    zodiacAffinity: ['Virgo', 'Capricorn'],
    element: 'Earth',
    keywords: ['Solitude', 'Contemplation', 'Inner Star'],
    uprightMeaning: 'Step back from the noise. Your lantern illuminates one honest, sovereign step at a time.',
    reversedMeaning: 'Excessive isolation; bring your hard-won insight back to the world.',
  },
  {
    number: 10,
    roman: 'X',
    name: 'Wheel of Fortune',
    astrologyRuler: 'Jupiter · Great Benefic',
    kabbalahPath: '21st Path (Kaph כ · Chesed to Netzach)',
    numerologyNote: '10 — Turning Cycles of Destiny & Karmic Acceleration',
    zodiacAffinity: ['Sagittarius', 'Pisces', 'Aquarius'],
    element: 'Fire',
    keywords: ['Destiny', 'Turning Cycles', 'Synchronicity'],
    uprightMeaning: 'The cosmic wheel turns in your favor. Embrace pivotal synchronicities and expanding fortune.',
    reversedMeaning: 'Resisting inevitable change; stay centered at the hub while the rim turns.',
  },
  {
    number: 11,
    roman: 'XI',
    name: 'Justice',
    astrologyRuler: 'Libra · Scales of Ma’at',
    kabbalahPath: '22nd Path (Lamed ל · Geburah to Tiphareth)',
    numerologyNote: '11 — Master Number of Equilibrium & Truth',
    zodiacAffinity: ['Libra', 'Taurus'],
    element: 'Air',
    keywords: ['Equilibrium', 'Karma', 'Clarity'],
    uprightMeaning: 'Cause and effect come into crystal balance. Truth, fairness, and integrity prevail.',
    reversedMeaning: 'Imbalance or avoiding accountability; weigh the facts without bias.',
  },
  {
    number: 12,
    roman: 'XII',
    name: 'The Hanged Man',
    astrologyRuler: 'Neptune · Waters of Surrender',
    kabbalahPath: '23rd Path (Mem מ · Geburah to Hod)',
    numerologyNote: '12 — Zodiacal Completion & Inverted Illumination',
    zodiacAffinity: ['Pisces', 'Cancer'],
    element: 'Water',
    keywords: ['Perspective', 'Surrender', 'Illumination'],
    uprightMeaning: 'Release control to gain a revolutionary new vantage point. Sacred pause precedes breakthrough.',
    reversedMeaning: 'Stalling out of fear or needless martyrdom; make the conscious shift.',
  },
  {
    number: 13,
    roman: 'XIII',
    name: 'Death',
    astrologyRuler: 'Scorpio · Phoenix of Pluto',
    kabbalahPath: '24th Path (Nun נ · Tiphareth to Netzach)',
    numerologyNote: '13 → 4 — Alchemical Transmutation & Rebirth',
    zodiacAffinity: ['Scorpio'],
    element: 'Water',
    keywords: ['Transformation', 'Rebirth', 'Metamorphosis'],
    uprightMeaning: 'Profound transmutation. Shed what has outlived its season so golden new life can rise.',
    reversedMeaning: 'Clinging to the past; trust the alchemy of renewal.',
  },
  {
    number: 14,
    roman: 'XIV',
    name: 'Temperance',
    astrologyRuler: 'Sagittarius · Arrow of Synthesis',
    kabbalahPath: '25th Path (Samekh ס · Tiphareth to Yesod)',
    numerologyNote: '14 → 5 — Golden Ratio Blending of Opposites',
    zodiacAffinity: ['Sagittarius'],
    element: 'Fire',
    keywords: ['Alchemy', 'Moderation', 'Harmony'],
    uprightMeaning: 'Blend fire and water into gold. Patience, synthesis, and middle-path mastery heal the divide.',
    reversedMeaning: 'Extremes or impatience; restore equilibrium to your daily rhythm.',
  },
  {
    number: 15,
    roman: 'XV',
    name: 'The Devil',
    astrologyRuler: 'Capricorn · Shadow of Saturn',
    kabbalahPath: '26th Path (Ayin ע · Tiphareth to Hod)',
    numerologyNote: '15 → 6 — Confronting the Shadow & Reclaiming Will',
    zodiacAffinity: ['Capricorn'],
    element: 'Earth',
    keywords: ['Shadow Work', 'Liberation', 'Desire'],
    uprightMeaning: 'Recognize the chains you hold voluntarily. Confronting shadow attachments unlocks raw sovereignty.',
    reversedMeaning: 'Breaking free from limiting habits and reclaiming your autonomy.',
  },
  {
    number: 16,
    roman: 'XVI',
    name: 'The Tower',
    astrologyRuler: 'Mars · Lightning of Awakening',
    kabbalahPath: '27th Path (Peh פ · Netzach to Hod)',
    numerologyNote: '16 → 7 — Liberation from False Structures',
    zodiacAffinity: ['Aries', 'Scorpio'],
    element: 'Fire',
    keywords: ['Sudden Awakening', 'Breakthrough', 'Truth'],
    uprightMeaning: 'False structures shatter in a flash of lightning, clearing the sky for authentic truth.',
    reversedMeaning: 'Averting upheaval or rebuilding stronger on bedrock.',
  },
  {
    number: 17,
    roman: 'XVII',
    name: 'The Star',
    astrologyRuler: 'Aquarius · Celestial Hope',
    kabbalahPath: '28th Path (Tzaddi צ · Netzach to Yesod)',
    numerologyNote: '17 → 8 — Eight-Pointed Star of Sirius & Renewal',
    zodiacAffinity: ['Aquarius'],
    element: 'Air',
    keywords: ['Starlight', 'Renewal', 'Inspiration'],
    uprightMeaning: 'Serene starlight pours blessing upon your path. Hope, healing, and cosmic inspiration are restored.',
    reversedMeaning: 'Temporary disillusionment; look up and reconnect with your guiding star.',
  },
  {
    number: 18,
    roman: 'XVIII',
    name: 'The Moon',
    astrologyRuler: 'Pisces · Tides of the Unseen',
    kabbalahPath: '29th Path (Qoph ק · Netzach to Malkuth)',
    numerologyNote: '18 → 9 — Astral Dreams & Deep Subconscious',
    zodiacAffinity: ['Pisces', 'Cancer'],
    element: 'Water',
    keywords: ['Dreams', 'Illusion', 'Deep Instinct'],
    uprightMeaning: 'Walk the twilight path between intuition and illusion. Trust your deepest instincts until dawn.',
    reversedMeaning: 'Mists clearing and hidden truths coming into the light.',
  },
  {
    number: 19,
    roman: 'XIX',
    name: 'The Sun',
    astrologyRuler: 'The Sun · Radiant Gold',
    kabbalahPath: '30th Path (Resh ר · Hod to Yesod)',
    numerologyNote: '19 → 10 → 1 — Solar Illumination & Supreme Joy',
    zodiacAffinity: ['Leo'],
    element: 'Fire',
    keywords: ['Vitality', 'Joy', 'Triumph'],
    uprightMeaning: 'Pure solar brilliance! Success, warmth, clarity, and abundant vitality illuminate every corner.',
    reversedMeaning: 'Clouded optimism; the sun still blazes just behind the passing cloud.',
  },
  {
    number: 20,
    roman: 'XX',
    name: 'Judgement',
    astrologyRuler: 'Pluto · Cosmic Awakening',
    kabbalahPath: '31st Path (Shin ש · Hod to Malkuth)',
    numerologyNote: '20 → 2 — Higher Calling & Spiritual Rebirth',
    zodiacAffinity: ['Scorpio', 'Leo'],
    element: 'Fire',
    keywords: ['Calling', 'Absolution', 'Awakening'],
    uprightMeaning: 'Answer your higher calling. Past lessons integrate into a powerful new chapter of purpose.',
    reversedMeaning: 'Self-criticism or ignoring the call; forgive the past and rise.',
  },
  {
    number: 21,
    roman: 'XXI',
    name: 'The World',
    astrologyRuler: 'Saturn · Crown of the Cosmos',
    kabbalahPath: '32nd Path (Tav ת · Yesod to Malkuth)',
    numerologyNote: '21 → 3 — Cosmic Wholeness & The Great Work Realized',
    zodiacAffinity: ['Capricorn', 'Taurus', 'Aquarius'],
    element: 'Earth',
    keywords: ['Fulfillment', 'Wholeness', 'Cosmic Mastery'],
    uprightMeaning: 'The Great Work reaches completion. All four elements dance in harmony around your realized crown.',
    reversedMeaning: 'One final loose thread remains before full completion; finish the cycle with pride.',
  },
];

const MINOR_SUIT_CONFIG: Array<{
  suit: 'Wands' | 'Cups' | 'Swords' | 'Pentacles';
  element: TarotElement;
  zodiacTriplicity: string[];
  domain: string;
}> = [
  {
    suit: 'Wands',
    element: 'Fire',
    zodiacTriplicity: ['Aries', 'Leo', 'Sagittarius'],
    domain: 'Willpower, Passion & Creative Spark',
  },
  {
    suit: 'Cups',
    element: 'Water',
    zodiacTriplicity: ['Cancer', 'Scorpio', 'Pisces'],
    domain: 'Emotion, Intuition & Love',
  },
  {
    suit: 'Swords',
    element: 'Air',
    zodiacTriplicity: ['Gemini', 'Libra', 'Aquarius'],
    domain: 'Intellect, Truth & Decisive Action',
  },
  {
    suit: 'Pentacles',
    element: 'Earth',
    zodiacTriplicity: ['Taurus', 'Virgo', 'Capricorn'],
    domain: 'Wealth, Craft & Material Mastery',
  },
];

const MINOR_RANKS_DATA: Array<{
  number: number;
  label: string;
  titlePrefix: string;
  planetTheme: string;
  sephirahOrRank: string;
  uprightTemplate: string;
  reversedTemplate: string;
}> = [
  {
    number: 1,
    label: 'Ace',
    titlePrefix: 'Ace',
    planetTheme: 'Root of the Element',
    sephirahOrRank: 'Kether (1) · Primordial Seed',
    uprightTemplate: 'Pure primordial seed of {domain} igniting a breakthrough opportunity.',
    reversedTemplate: 'Delayed spark or blocked channel in {domain}; ground your energy.',
  },
  {
    number: 2,
    label: 'II',
    titlePrefix: 'Two',
    planetTheme: 'Cardinal Polarity',
    sephirahOrRank: 'Chokmah (2) · First Decan',
    uprightTemplate: 'Harmonious partnership, bold choice, and magnetic balance within {domain}.',
    reversedTemplate: 'Indecision or split focus across {domain}.',
  },
  {
    number: 3,
    label: 'III',
    titlePrefix: 'Three',
    planetTheme: 'Solar Expansion',
    sephirahOrRank: 'Binah (3) · Second Decan',
    uprightTemplate: 'Initial expansion, collaboration, and visible flowering in {domain}.',
    reversedTemplate: 'Misaligned teamwork or scattered effort in {domain}.',
  },
  {
    number: 4,
    label: 'IV',
    titlePrefix: 'Four',
    planetTheme: 'Sacred Foundation',
    sephirahOrRank: 'Chesed (4) · Third Decan',
    uprightTemplate: 'Stable sanctuary, structured consolidation, and milestone celebration in {domain}.',
    reversedTemplate: 'Stagnation or restlessness within {domain}; refresh your foundations.',
  },
  {
    number: 5,
    label: 'V',
    titlePrefix: 'Five',
    planetTheme: 'Dynamic Catalyst',
    sephirahOrRank: 'Geburah (5) · First Fixed Decan',
    uprightTemplate: 'Crucible of change and spirited test that sharpens your mastery of {domain}.',
    reversedTemplate: 'Resolving tension and moving past conflict in {domain}.',
  },
  {
    number: 6,
    label: 'VI',
    titlePrefix: 'Six',
    planetTheme: 'Solar Harmony',
    sephirahOrRank: 'Tiphareth (6) · Solar Heart Decan',
    uprightTemplate: 'Reciprocity, victorious recognition, and flowing grace in {domain}.',
    reversedTemplate: 'Unequal exchange or nostalgia in {domain}.',
  },
  {
    number: 7,
    label: 'VII',
    titlePrefix: 'Seven',
    planetTheme: 'Mystic Valor',
    sephirahOrRank: 'Netzach (7) · Third Fixed Decan',
    uprightTemplate: 'Perseverance, strategic vision, and standing firm for your truth in {domain}.',
    reversedTemplate: 'Overthinking or second-guessing your progress in {domain}.',
  },
  {
    number: 8,
    label: 'VIII',
    titlePrefix: 'Eight',
    planetTheme: 'Swift Mastery',
    sephirahOrRank: 'Hod (8) · First Mutable Decan',
    uprightTemplate: 'Dedicated craftsmanship and rapid momentum accelerating {domain}.',
    reversedTemplate: 'Impatience or restrictive beliefs around {domain}.',
  },
  {
    number: 9,
    label: 'IX',
    titlePrefix: 'Nine',
    planetTheme: 'Culminating Fruition',
    sephirahOrRank: 'Yesod (9) · Second Mutable Decan',
    uprightTemplate: 'Resilient self-sufficiency and near-complete fulfillment in {domain}.',
    reversedTemplate: 'Fatigue just before the finish line in {domain}; rest and persist.',
  },
  {
    number: 10,
    label: 'X',
    titlePrefix: 'Ten',
    planetTheme: 'Complete Cycle & Legacy',
    sephirahOrRank: 'Malkuth (10) · Final Decan',
    uprightTemplate: 'Lasting legacy, overflowing culmination, and generational completion in {domain}.',
    reversedTemplate: 'Carrying too much weight alone in {domain}; delegate and release.',
  },
  {
    number: 11,
    label: 'Page',
    titlePrefix: 'Page',
    planetTheme: 'Messenger of the Element',
    sephirahOrRank: 'Earth of the Element · Court',
    uprightTemplate: 'Curious student, auspicious message, and fresh inspiration in {domain}.',
    reversedTemplate: 'Immature impulse or delayed news regarding {domain}.',
  },
  {
    number: 12,
    label: 'Knight',
    titlePrefix: 'Knight',
    planetTheme: 'Questing Champion',
    sephirahOrRank: 'Fire/Air of the Element · Court',
    uprightTemplate: 'Unstoppable quest, fearless action, and charging forward in {domain}.',
    reversedTemplate: 'Hasty charge or stalled momentum in {domain}.',
  },
  {
    number: 13,
    label: 'Queen',
    titlePrefix: 'Queen',
    planetTheme: 'Inward Sovereign',
    sephirahOrRank: 'Water of the Element · Court',
    uprightTemplate: 'Magnetic wisdom, intuitive command, and radiant nurture of {domain}.',
    reversedTemplate: 'Emotional overwhelm or guardedness in {domain}.',
  },
  {
    number: 14,
    label: 'King',
    titlePrefix: 'King',
    planetTheme: 'Master of the Element',
    sephirahOrRank: 'Fire of the Element · Court',
    uprightTemplate: 'Supreme mastery, visionary leadership, and mature sovereignty over {domain}.',
    reversedTemplate: 'Over-controlling or rigid expectations in {domain}.',
  },
];

export function createReal78CardTarotDeck(): RealTarotCard[] {
  const deck: RealTarotCard[] = [];

  for (const m of MAJOR_ARCANA_DATA) {
    deck.push({
      id: `major_${m.number}_${Math.random().toString(36).slice(2, 6)}`,
      arcana: 'Major',
      number: m.number,
      romanOrRank: m.roman,
      name: m.name,
      astrologyRuler: m.astrologyRuler,
      kabbalahPathOrDecan: m.kabbalahPath,
      numerologyNote: m.numerologyNote,
      zodiacAffinity: m.zodiacAffinity,
      element: m.element,
      keywords: m.keywords,
      uprightMeaning: m.uprightMeaning,
      reversedMeaning: m.reversedMeaning,
      celestialPower: 90 + m.number * 2,
      isReversed: Math.random() < 0.25,
      revealed: false,
    });
  }

  for (const s of MINOR_SUIT_CONFIG) {
    for (const r of MINOR_RANKS_DATA) {
      deck.push({
        id: `minor_${s.suit}_${r.number}_${Math.random().toString(36).slice(2, 6)}`,
        arcana: 'Minor',
        number: r.number,
        romanOrRank: r.label,
        name: `${r.titlePrefix} of ${s.suit}`,
        suit: s.suit,
        astrologyRuler: `${r.planetTheme} · ${s.zodiacTriplicity.join(' / ')}`,
        kabbalahPathOrDecan: r.sephirahOrRank,
        numerologyNote: `${r.number} — ${r.planetTheme} in ${s.suit}`,
        zodiacAffinity: s.zodiacTriplicity,
        element: s.element,
        keywords: [s.suit, s.element, r.titlePrefix],
        uprightMeaning: r.uprightTemplate.replace('{domain}', s.domain.toLowerCase()),
        reversedMeaning: r.reversedTemplate.replace('{domain}', s.domain.toLowerCase()),
        celestialPower: 50 + r.number * 3,
        isReversed: Math.random() < 0.25,
        revealed: false,
      });
    }
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export interface ElementalDignityAspect {
  pairLabel: string;
  elementsLabel: string;
  dignityType:
    | 'Friendly & Strengthening'
    | 'Harmonious Amplification'
    | 'Complementary Balance'
    | 'Contrary Alchemical Tension';
  bonusScore: number;
  explanation: string;
}

function evaluateElementalDignity(a: RealTarotCard, b: RealTarotCard): ElementalDignityAspect {
  const e1 = a.element;
  const e2 = b.element;
  const pairLabel = `${a.name} ↔ ${b.name}`;
  const elementsLabel = `${e1} + ${e2}`;

  if (e1 === e2) {
    return {
      pairLabel,
      elementsLabel,
      dignityType: 'Harmonious Amplification',
      bonusScore: 22,
      explanation: `Twin ${e1} currents reinforce one another, doubling clarity and momentum.`,
    };
  }
  const set = new Set([e1, e2]);
  if ((set.has('Fire') && set.has('Air')) || (set.has('Water') && set.has('Earth'))) {
    return {
      pairLabel,
      elementsLabel,
      dignityType: 'Friendly & Strengthening',
      bonusScore: 28,
      explanation: set.has('Fire')
        ? 'Air fans the Sacred Flame—inspiration and action accelerate each other.'
        : 'Living Water nourishes fertile Earth—intuition manifests tangible abundance.',
    };
  }
  if ((set.has('Fire') && set.has('Water')) || (set.has('Air') && set.has('Earth'))) {
    return {
      pairLabel,
      elementsLabel,
      dignityType: 'Contrary Alchemical Tension',
      bonusScore: 8,
      explanation: set.has('Fire')
        ? 'Fire & Water meet in alchemical steam—balance passion with emotional poise.'
        : 'Air & Earth contrast abstract vision with practical ground—bridge idea and execution.',
    };
  }
  return {
    pairLabel,
    elementsLabel,
    dignityType: 'Complementary Balance',
    bonusScore: 16,
    explanation: `${e1} and ${e2} cooperate as steady allies across spiritual and material planes.`,
  };
}

function createStandardDeck(): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of SUITS) {
    for (const r of RANKS) {
      deck.push({
        id: `${r.rank}${suit}_${Math.random().toString(36).slice(2, 6)}`,
        suit,
        rank: r.rank,
        value: r.value,
        solitaireValue: r.solitaireValue,
        faceUp: true,
      });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function evaluateHoldemHand(cards: PlayingCard[]): { score: number; label: string } {
  if (cards.length === 0) return { score: 0, label: 'No Cards' };
  const counts: Record<number, number> = {};
  const suitCounts: Record<string, PlayingCard[]> = { '♠': [], '♥': [], '♦': [], '♣': [] };
  for (const c of cards) {
    counts[c.value] = (counts[c.value] || 0) + 1;
    suitCounts[c.suit].push(c);
  }
  const valuesDesc = Object.keys(counts)
    .map(Number)
    .sort((a, b) => b - a);
  const freqPairs = Object.entries(counts)
    .map(([v, count]) => ({ val: Number(v), count }))
    .sort((a, b) => b.count - a.count || b.val - a.val);

  const flushSuit = Object.values(suitCounts).find((arr) => arr.length >= 5);

  const uniqueVals = [...valuesDesc];
  if (uniqueVals.includes(14)) uniqueVals.push(1);
  let straightHigh = 0;
  for (let i = 0; i <= uniqueVals.length - 5; i++) {
    if (uniqueVals[i] - uniqueVals[i + 4] === 4) {
      straightHigh = uniqueVals[i];
      break;
    }
  }

  if (flushSuit && straightHigh > 0) {
    return {
      score: 800 + straightHigh,
      label: straightHigh === 14 ? 'Royal Flush' : 'Straight Flush',
    };
  }
  if (freqPairs[0]?.count === 4) {
    return { score: 700 + freqPairs[0].val, label: 'Four of a Kind' };
  }
  if (freqPairs[0]?.count === 3 && freqPairs[1]?.count >= 2) {
    return { score: 600 + freqPairs[0].val, label: 'Full House' };
  }
  if (flushSuit) {
    const topFlush = Math.max(...flushSuit.map((c) => c.value));
    return { score: 500 + topFlush, label: 'Flush' };
  }
  if (straightHigh > 0) {
    return { score: 400 + straightHigh, label: 'Straight' };
  }
  if (freqPairs[0]?.count === 3) {
    return { score: 300 + freqPairs[0].val, label: 'Three of a Kind' };
  }
  if (freqPairs[0]?.count === 2 && freqPairs[1]?.count === 2) {
    return { score: 200 + freqPairs[0].val + freqPairs[1].val * 0.01, label: 'Two Pair' };
  }
  if (freqPairs[0]?.count === 2) {
    return { score: 100 + freqPairs[0].val, label: 'One Pair' };
  }
  return {
    score: valuesDesc[0] || 0,
    label: `High Card ${RANKS.find((r) => r.value === valuesDesc[0])?.rank || ''}`,
  };
}

function chooseAiDrawHoldIndices(hand: PlayingCard[]): Set<number> {
  const held = new Set<number>();
  const valCounts: Record<number, number[]> = {};
  const suitIndices: Record<string, number[]> = { '♠': [], '♥': [], '♦': [], '♣': [] };

  hand.forEach((c, idx) => {
    valCounts[c.value] = [...(valCounts[c.value] || []), idx];
    suitIndices[c.suit].push(idx);
  });

  // Hold any made pair, trips, or quads
  Object.values(valCounts).forEach((indices) => {
    if (indices.length >= 2) {
      indices.forEach((i) => held.add(i));
    }
  });
  if (held.size > 0) return held;

  // Otherwise hold 4-to-a-flush or 5-card flush
  const flushDraw = Object.values(suitIndices).find((arr) => arr.length >= 4);
  if (flushDraw) {
    flushDraw.forEach((i) => held.add(i));
    return held;
  }

  // Otherwise hold Aces and Kings as high kickers
  hand.forEach((c, idx) => {
    if (c.value >= 13) held.add(idx);
  });
  return held;
}

function blackjackHandTotal(cards: PlayingCard[]): { total: number; soft: boolean } {
  let sum = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') {
      aces += 1;
      sum += 11;
    } else if (['K', 'Q', 'J', '10'].includes(c.rank)) {
      sum += 10;
    } else {
      sum += c.value;
    }
  }
  while (sum > 21 && aces > 0) {
    sum -= 10;
    aces -= 1;
  }
  return { total: sum, soft: aces > 0 };
}

function createUnoDeck(): UnoCard[] {
  const colors: Array<'R' | 'G' | 'B' | 'Y'> = ['R', 'G', 'B', 'Y'];
  const labels = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', 'Reverse', '+2'];
  const deck: UnoCard[] = [];
  for (const col of colors) {
    for (const lbl of labels) {
      deck.push({
        id: `${col}_${lbl}_${Math.random().toString(36).slice(2, 6)}`,
        color: col,
        label: lbl,
      });
      if (lbl !== '0') {
        deck.push({
          id: `${col}_${lbl}_b_${Math.random().toString(36).slice(2, 6)}`,
          color: col,
          label: lbl,
        });
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `W_Wild_${i}_${Math.random().toString(36).slice(2, 5)}`, color: 'W', label: 'Wild' });
    deck.push({ id: `W_Plus4_${i}_${Math.random().toString(36).slice(2, 5)}`, color: 'W', label: '+4' });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function buildPlayingCardInspector(
  card: PlayingCard,
  contextMode: 'solitaire' | 'poker' | 'blackjack'
): InspectableCardPayload {
  const isRed = card.suit === '♥' || card.suit === '♦';
  const suitFull = SUIT_NAMES[card.suit];

  if (contextMode === 'solitaire') {
    return {
      id: card.id,
      title: `${card.rank} of ${suitFull}`,
      subtitle: 'Klondike Tableau & Foundation Card',
      suitOrColor: `${suitFull} (${isRed ? 'Red Suit' : 'Black Suit'})`,
      rankOrBadge: `${card.rank}${card.suit}`,
      isRed,
      description:
        card.solitaireValue === 1
          ? `Ace (${card.suit}) immediately unlocks the ${suitFull} Foundation pile.`
          : card.solitaireValue === 13
          ? `King (${card.suit}) can anchor any empty Tableau column to open hidden cascades.`
          : `Stacks onto ${isRed ? 'Black (♠/♣)' : 'Red (♥/♦)'} ${
              RANKS.find((r) => r.solitaireValue === card.solitaireValue + 1)?.rank || ''
            } in the Tableau, or promotes to ${suitFull} Foundation after ${
              RANKS.find((r) => r.solitaireValue === card.solitaireValue - 1)?.rank || ''
            }${card.suit}.`,
      keywords: [
        {
          term: 'Alternating Cascade',
          definition: 'Tableau columns build downward K → A alternating Red and Black suits.',
        },
        {
          term: 'Suit Foundation',
          definition: 'Drag or double-tap eligible exposed cards to stack A → K by identical suit.',
        },
      ],
    };
  }

  if (contextMode === 'blackjack') {
    const ptVal =
      card.rank === 'A'
        ? '1 or 11 (Soft Ace)'
        : ['K', 'Q', 'J', '10'].includes(card.rank)
        ? '10 Points'
        : `${card.value} Points`;
    return {
      id: card.id,
      title: `${card.rank} of ${suitFull}`,
      subtitle: 'Casino Blackjack 21 Shoe Card',
      suitOrColor: suitFull,
      rankOrBadge: `${card.rank}${card.suit}`,
      isRed,
      description: `Contributes ${ptVal} toward 21. Natural Ace + 10-value card pays 3:2 immediately.`,
      keywords: [
        {
          term: 'Soft vs. Hard Total',
          definition: 'Aces count as 11 until the hand would exceed 21, then automatically flex to 1.',
        },
        {
          term: 'Double Down (2×)',
          definition: 'Doubles your wager on a 2-card opening hand for exactly one decisive hit card.',
        },
      ],
    };
  }

  return {
    id: card.id,
    title: `${card.rank} of ${suitFull}`,
    subtitle: 'Poker Showdown Card',
    suitOrColor: suitFull,
    rankOrBadge: `${card.rank}${card.suit}`,
    isRed,
    description: `Rank value ${card.value}/14 in ${suitFull}. Combines for Pairs, Straights, Flushes, and Full Houses.`,
    keywords: [
      {
        term: 'Flush Synergy',
        definition: `Five ${suitFull} (${card.suit}) cards form a Flush (500+ rank power).`,
      },
      {
        term: 'Kicker Tie-Breaker',
        definition: 'Higher unpaired ranks break ties when peers hold identical pair structures.',
      },
    ],
  };
}

interface SolitaireSnapshot {
  columns: PlayingCard[][];
  stock: PlayingCard[];
  waste: PlayingCard[];
  foundations: Record<'♠' | '♥' | '♦' | '♣', PlayingCard[]>;
  moves: number;
}

const ROPE_DURATION_SECONDS = 25;

export const CardGamesView: React.FC<CardGamesViewProps> = ({
  bankroll,
  points,
  dailyPointsEarned,
  isP2PConnected,
  activeP2PPointBet,
  onPlaceP2PPointBet,
  onCommitResult,
  onSyncP2PState,
  remoteRoomState,
}) => {
  // Default to Klondike Solitaire per confirmed user order!
  const [activeGame, setActiveGame] = useState<CardGameMode>('solitaire');

  const {
    winMenuPayload,
    broadcastMove,
    triggerGameComplete,
    dismissWinMenu,
    handlePlayAgain,
  } = useP2PGameSync({
    points,
    dailyPointsEarned,
    isP2PConnected,
    activeP2PPointBet,
    onCommitResult,
    onSyncP2PState,
  });

  // ==================== SHARED TACTILE TABLE ENGINE & HUD STATE ====================
  const [dragVector, setDragVector] = useState<{
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    hoveredSlotId: string | null;
  } | null>(null);
  const [inspectedCard, setInspectedCard] = useState<{
    payload: InspectableCardPayload;
    anchor: { x: number; y: number };
  } | null>(null);
  const [actionLog, setActionLog] = useState<CardActionLogItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPileBrowserOpen, setIsPileBrowserOpen] = useState(false);
  const [popups, setPopups] = useState<FloatingPopupItem[]>([]);
  const [chainSteps, setChainSteps] = useState<ResolutionChainStep[]>([]);
  const [isShuffling, setIsShuffling] = useState(false);
  const [shakeTick, setShakeTick] = useState(0);

  // Opponent Telemetry & Emotes
  const [playerEmote, setPlayerEmote] = useState<string | null>(null);
  const [opponentEmote, setOpponentEmote] = useState<string | null>(null);
  const [opponentInspectIdx, setOpponentInspectIdx] = useState<number | null>(null);

  // Burning Rope Turn Timer (Competitive modes only by default, toggleable)
  const [ropeEnabled, setRopeEnabled] = useState<boolean>(true);
  const [ropeSecondsLeft, setRopeSecondsLeft] = useState<number>(ROPE_DURATION_SECONDS);

  const appendActionLog = useCallback(
    (actor: string, action: string, detail: string, deltaLabel?: string) => {
      setActionLog((prev) => [
        {
          id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          actor,
          action,
          detail,
          deltaLabel,
          timestamp: Date.now(),
        },
        ...prev.slice(0, 39),
      ]);
    },
    []
  );

  const spawnPopup = useCallback(
    (text: string, tone: FloatingPopupItem['tone'] = 'gold') => {
      const id = `pop_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      setPopups((prev) => [...prev.slice(-3), { id, text, tone }]);
      window.setTimeout(() => {
        setPopups((prev) => prev.filter((item) => item.id !== id));
      }, 1750);
    },
    []
  );

  const triggerChainBanner = useCallback((labels: string[]) => {
    const mapped: ResolutionChainStep[] = labels.map((label, idx) => ({
      id: `ch_${Date.now()}_${idx}`,
      stepNumber: idx + 1,
      label,
    }));
    setChainSteps(mapped);
    window.setTimeout(() => {
      setChainSteps([]);
    }, 2600);
  }, []);

  const triggerTableShuffle = useCallback(() => {
    setIsShuffling(true);
    window.setTimeout(() => setIsShuffling(false), 480);
  }, []);

  const triggerImpactShake = useCallback(() => {
    setShakeTick((t) => t + 1);
  }, []);

  const handleSendEmote = useCallback(
    (emote: string) => {
      setPlayerEmote(emote);
      if (activeGame !== 'tarot') {
        nativeBridge.playSfx('move');
      }
      broadcastMove(activeGame, { emote });
      appendActionLog('You', 'Sent Emote', `“${emote}”`);
      window.setTimeout(() => setPlayerEmote(null), 2600);

      // Friendly peer acknowledgement
      window.setTimeout(() => {
        const replies = ['Respect!', 'Good Luck', 'Nice Play!', 'Let’s Roll!'];
        const reply = replies[Math.floor(Math.random() * replies.length)];
        setOpponentEmote(reply);
        window.setTimeout(() => setOpponentEmote(null), 2600);
      }, 950);
    },
    [activeGame, appendActionLog, broadcastMove]
  );

  // Subtle Opponent Card-Hover Telemetry Simulation on Competitive Modes
  useEffect(() => {
    if (activeGame === 'solitaire' || activeGame === 'tarot') {
      setOpponentInspectIdx(null);
      return;
    }
    const timer = window.setInterval(() => {
      setOpponentInspectIdx(Math.random() < 0.55 ? Math.floor(Math.random() * 5) : null);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [activeGame]);

  // ==================== 1. KLONDIKE SOLITAIRE STATE ====================
  const [solColumns, setSolColumns] = useState<PlayingCard[][]>([]);
  const [solStock, setSolStock] = useState<PlayingCard[]>([]);
  const [solWaste, setSolWaste] = useState<PlayingCard[]>([]);
  const [solFoundations, setSolFoundations] = useState<Record<'♠' | '♥' | '♦' | '♣', PlayingCard[]>>({
    '♠': [],
    '♥': [],
    '♦': [],
    '♣': [],
  });
  const [solMoves, setSolMoves] = useState<number>(0);
  const [solHistory, setSolHistory] = useState<SolitaireSnapshot[]>([]);
  const [solSelected, setSolSelected] = useState<{ source: 'waste' | number; cardIndex: number } | null>(null);
  const [solBanner, setSolBanner] = useState<string>(
    'Tap or drag any face-up card onto an alternating Tableau column or Suit Foundation!'
  );

  const pushSolHistory = () => {
    setSolHistory((prev) => [
      ...prev.slice(-19),
      {
        columns: solColumns.map((col) => col.map((c) => ({ ...c }))),
        stock: solStock.map((c) => ({ ...c })),
        waste: solWaste.map((c) => ({ ...c })),
        foundations: {
          '♠': [...solFoundations['♠']],
          '♥': [...solFoundations['♥']],
          '♦': [...solFoundations['♦']],
          '♣': [...solFoundations['♣']],
        },
        moves: solMoves,
      },
    ]);
  };

  const undoSolitaireMove = () => {
    if (solHistory.length === 0) return;
    const last = solHistory[solHistory.length - 1];
    setSolColumns(last.columns);
    setSolStock(last.stock);
    setSolWaste(last.waste);
    setSolFoundations(last.foundations);
    setSolMoves(last.moves);
    setSolHistory((prev) => prev.slice(0, -1));
    setSolSelected(null);
    setSolBanner('Undid previous move.');
    appendActionLog('You', 'Undo Solitaire Move', `Restored state at move ${last.moves}`);
    nativeBridge.playSfx('move');
  };

  const initSolitaire = useCallback(() => {
    const d = createStandardDeck();
    const cols: PlayingCard[][] = [];
    let cursor = 0;
    for (let c = 0; c < 7; c++) {
      const col: PlayingCard[] = [];
      for (let r = 0; r <= c; r++) {
        col.push({ ...d[cursor++], faceUp: r === c });
      }
      cols.push(col);
    }
    setSolColumns(cols);
    setSolStock(d.slice(cursor).map((c) => ({ ...c, faceUp: false })));
    setSolWaste([]);
    setSolFoundations({ '♠': [], '♥': [], '♦': [], '♣': [] });
    setSolMoves(0);
    setSolHistory([]);
    setSolSelected(null);
    setSolBanner('Klondike Solitaire dealt · Drag or tap cards to build Foundations A → K by Suit.');
    triggerTableShuffle();
    nativeBridge.playSfx('card');
  }, [triggerTableShuffle]);

  useEffect(() => {
    initSolitaire();
  }, [initSolitaire]);

  const totalFoundationCards = useMemo(
    () =>
      solFoundations['♠'].length +
      solFoundations['♥'].length +
      solFoundations['♦'].length +
      solFoundations['♣'].length,
    [solFoundations]
  );

  const canMoveToFoundation = (
    card: PlayingCard,
    foundationsState = solFoundations
  ): boolean => {
    const pile = foundationsState[card.suit];
    if (pile.length === 0) return card.solitaireValue === 1;
    const topCard = pile[pile.length - 1];
    return card.solitaireValue === topCard.solitaireValue + 1;
  };

  const isOppositeColor = (s1: PlayingCard['suit'], s2: PlayingCard['suit']) => {
    const red1 = s1 === '♥' || s1 === '♦';
    const red2 = s2 === '♥' || s2 === '♦';
    return red1 !== red2;
  };

  const checkSolitaireWin = (
    nextFoundations: Record<'♠' | '♥' | '♦' | '♣', PlayingCard[]>,
    moveCount = solMoves + 1
  ) => {
    const count =
      nextFoundations['♠'].length +
      nextFoundations['♥'].length +
      nextFoundations['♦'].length +
      nextFoundations['♣'].length;
    if (count === 52) {
      setSolBanner('Klondike Solitaire Complete! All 52 cards built on Foundations (+350 chips)!');
      spawnPopup('+350 CHIPS · SOLITAIRE CLEAR!', 'gold');
      triggerImpactShake();
      nativeBridge.playSfx('victory');
      triggerGameComplete({
        gameId: 'solitaire',
        gameTitle: 'Klondike Solitaire',
        gameTypeLedger: 'SOLITAIRE',
        outcome: 'win',
        headline: 'All 4 Suit Foundations Complete!',
        subheadline: `You promoted all 52 cards (Aces through Kings across ♠, ♥, ♦, ♣) in ${moveCount} moves!`,
        chipsDelta: 350,
        stats: [
          { label: 'Foundation Cards', value: '52 / 52' },
          { label: 'Total Moves', value: `${moveCount} Moves` },
          { label: 'Suits Completed', value: '♠ ♥ ♦ ♣' },
        ],
        statePayload: { moves: moveCount },
        onPlayAgain: initSolitaire,
      });
    }
  };

  const completeSolitaireDeckShowcase = () => {
    pushSolHistory();
    const fullFoundations: Record<'♠' | '♥' | '♦' | '♣', PlayingCard[]> = {
      '♠': [],
      '♥': [],
      '♦': [],
      '♣': [],
    };
    for (const s of SUITS) {
      for (const r of RANKS) {
        fullFoundations[s].push({
          id: `win_${r.rank}${s}`,
          suit: s,
          rank: r.rank,
          value: r.value,
          solitaireValue: r.solitaireValue,
          faceUp: true,
        });
      }
    }
    setSolColumns([[], [], [], [], [], [], []]);
    setSolStock([]);
    setSolWaste([]);
    setSolFoundations(fullFoundations);
    setSolSelected(null);
    appendActionLog('You', 'Completed All Foundations', '52/52 cards promoted', '+350 Chips');
    checkSolitaireWin(fullFoundations, solMoves + 12);
  };

  const drawSolStock = () => {
    pushSolHistory();
    nativeBridge.playSfx('card');
    if (solStock.length > 0) {
      const top = { ...solStock[0], faceUp: true };
      setSolWaste([top, ...solWaste]);
      setSolStock(solStock.slice(1));
      setSolMoves((m) => m + 1);
      setSolBanner(`Drew ${top.rank}${top.suit} to Waste pile.`);
      appendActionLog('You', 'Drew Stock Card', `${top.rank}${top.suit} → Waste`);
    } else if (solWaste.length > 0) {
      triggerTableShuffle();
      setSolStock([...solWaste].reverse().map((c) => ({ ...c, faceUp: false })));
      setSolWaste([]);
      setSolMoves((m) => m + 1);
      setSolBanner('Recycled Waste pile back into Stock.');
      appendActionLog('You', 'Recycled Waste', `${solWaste.length} cards returned to Stock`);
    } else {
      setSolBanner('Both Stock and Waste piles are empty.');
    }
    setSolSelected(null);
  };

  const handleWasteClick = () => {
    if (solWaste.length === 0) return;
    const card = solWaste[0];
    if (solSelected?.source === 'waste') {
      if (canMoveToFoundation(card)) {
        pushSolHistory();
        const nextFound = {
          ...solFoundations,
          [card.suit]: [...solFoundations[card.suit], card],
        };
        setSolFoundations(nextFound);
        setSolWaste(solWaste.slice(1));
        setSolMoves((m) => m + 1);
        setSolSelected(null);
        nativeBridge.playSfx('chip');
        spawnPopup(`${card.rank}${card.suit} → Foundation!`, 'gold');
        appendActionLog('You', 'Promoted Waste Card', `${card.rank}${card.suit} → ${card.suit} Foundation`);
        setSolBanner(`Promoted ${card.rank}${card.suit} from Waste to ${card.suit} Foundation!`);
        checkSolitaireWin(nextFound);
      } else {
        setSolSelected(null);
        setSolBanner('Selection cleared.');
      }
      return;
    }

    setSolSelected({ source: 'waste', cardIndex: 0 });
    nativeBridge.playSfx('move');
    setSolBanner(
      `Selected ${card.rank}${card.suit} · Tap/drag to a valid Tableau column or ${card.suit} Foundation!`
    );
  };

  const handleFoundationClick = (suit: '♠' | '♥' | '♦' | '♣') => {
    if (!solSelected) {
      if (solWaste.length > 0 && solWaste[0].suit === suit && canMoveToFoundation(solWaste[0])) {
        pushSolHistory();
        const card = solWaste[0];
        const nextFound = { ...solFoundations, [suit]: [...solFoundations[suit], card] };
        setSolFoundations(nextFound);
        setSolWaste(solWaste.slice(1));
        setSolMoves((m) => m + 1);
        nativeBridge.playSfx('chip');
        spawnPopup(`${card.rank}${card.suit} → ${suit}`, 'gold');
        appendActionLog('You', 'Foundation Promotion', `${card.rank}${card.suit} from Waste`);
        setSolBanner(`Promoted ${card.rank}${card.suit} from Waste to ${suit} Foundation!`);
        checkSolitaireWin(nextFound);
        return;
      }
      for (let cIdx = 0; cIdx < solColumns.length; cIdx++) {
        const col = solColumns[cIdx];
        if (col.length > 0) {
          const tip = col[col.length - 1];
          if (tip.faceUp && tip.suit === suit && canMoveToFoundation(tip)) {
            pushSolHistory();
            const nextFound = { ...solFoundations, [suit]: [...solFoundations[suit], tip] };
            const nextCols = solColumns.map((c, idx) => {
              if (idx !== cIdx) return c;
              const sliced = c.slice(0, -1);
              if (sliced.length > 0) sliced[sliced.length - 1] = { ...sliced[sliced.length - 1], faceUp: true };
              return sliced;
            });
            setSolFoundations(nextFound);
            setSolColumns(nextCols);
            setSolMoves((m) => m + 1);
            nativeBridge.playSfx('chip');
            spawnPopup(`${tip.rank}${tip.suit} → ${suit}`, 'gold');
            appendActionLog('You', 'Foundation Promotion', `${tip.rank}${tip.suit} from Col ${cIdx + 1}`);
            setSolBanner(`Promoted ${tip.rank}${tip.suit} from Column ${cIdx + 1} to ${suit} Foundation!`);
            checkSolitaireWin(nextFound);
            return;
          }
        }
      }
      return;
    }

    if (solSelected.source === 'waste') {
      const card = solWaste[0];
      if (card && card.suit === suit && canMoveToFoundation(card)) {
        pushSolHistory();
        const nextFound = { ...solFoundations, [suit]: [...solFoundations[suit], card] };
        setSolFoundations(nextFound);
        setSolWaste(solWaste.slice(1));
        setSolMoves((m) => m + 1);
        setSolSelected(null);
        nativeBridge.playSfx('chip');
        spawnPopup(`${card.rank}${card.suit} → ${suit}`, 'gold');
        appendActionLog('You', 'Foundation Promotion', `${card.rank}${card.suit} → ${suit}`);
        setSolBanner(`Promoted ${card.rank}${card.suit} to ${suit} Foundation!`);
        checkSolitaireWin(nextFound);
      } else {
        nativeBridge.playSfx('error');
        setSolBanner(`Cannot move ${card?.rank}${card?.suit} to ${suit} Foundation yet.`);
      }
    } else {
      const srcColIdx = solSelected.source;
      const srcCol = solColumns[srcColIdx];
      if (solSelected.cardIndex === srcCol.length - 1) {
        const card = srcCol[solSelected.cardIndex];
        if (card && card.suit === suit && canMoveToFoundation(card)) {
          pushSolHistory();
          const nextFound = { ...solFoundations, [suit]: [...solFoundations[suit], card] };
          const nextCols = solColumns.map((c, idx) => {
            if (idx !== srcColIdx) return c;
            const sliced = c.slice(0, -1);
            if (sliced.length > 0) sliced[sliced.length - 1] = { ...sliced[sliced.length - 1], faceUp: true };
            return sliced;
          });
          setSolFoundations(nextFound);
          setSolColumns(nextCols);
          setSolMoves((m) => m + 1);
          setSolSelected(null);
          nativeBridge.playSfx('chip');
          spawnPopup(`${card.rank}${card.suit} → ${suit}`, 'gold');
          appendActionLog('You', 'Foundation Promotion', `${card.rank}${card.suit} → ${suit}`);
          setSolBanner(`Promoted ${card.rank}${card.suit} to ${suit} Foundation!`);
          checkSolitaireWin(nextFound);
          return;
        }
      }
      nativeBridge.playSfx('error');
      setSolBanner('Only an exposed top card matching the next suit rank (A → K) can move to Foundation.');
    }
  };

  // Drag-and-drop magnetic slot resolution for Solitaire
  const handleSolitaireDropToSlot = (
    slotId: string,
    source: { type: 'waste' } | { type: 'col'; colIdx: number; cardIdx: number }
  ) => {
    let movingCards: PlayingCard[] = [];
    if (source.type === 'waste') {
      if (solWaste.length > 0) movingCards = [solWaste[0]];
    } else {
      movingCards = solColumns[source.colIdx]?.slice(source.cardIdx) || [];
    }
    if (movingCards.length === 0) return;

    if (slotId.startsWith('foundation-')) {
      const suit = slotId.replace('foundation-', '') as '♠' | '♥' | '♦' | '♣';
      if (movingCards.length === 1 && movingCards[0].suit === suit && canMoveToFoundation(movingCards[0])) {
        pushSolHistory();
        const card = movingCards[0];
        const nextFound = { ...solFoundations, [suit]: [...solFoundations[suit], card] };
        if (source.type === 'waste') {
          setSolWaste(solWaste.slice(1));
        } else {
          setSolColumns((prev) =>
            prev.map((col, idx) => {
              if (idx !== source.colIdx) return col;
              const rem = col.slice(0, source.cardIdx);
              if (rem.length > 0) rem[rem.length - 1] = { ...rem[rem.length - 1], faceUp: true };
              return rem;
            })
          );
        }
        setSolFoundations(nextFound);
        setSolMoves((m) => m + 1);
        setSolSelected(null);
        nativeBridge.playSfx('chip');
        spawnPopup(`${card.rank}${card.suit} Snapped to ${suit}!`, 'gold');
        appendActionLog('You', 'Magnetic Drop → Foundation', `${card.rank}${card.suit}`);
        setSolBanner(`Promoted ${card.rank}${card.suit} to ${suit} Foundation!`);
        checkSolitaireWin(nextFound);
      } else {
        nativeBridge.playSfx('error');
      }
      return;
    }

    if (slotId.startsWith('tableau-')) {
      const targetColIdx = Number(slotId.replace('tableau-', ''));
      if (Number.isNaN(targetColIdx)) return;
      if (source.type === 'col' && source.colIdx === targetColIdx) return;

      const targetCol = solColumns[targetColIdx] || [];
      const lead = movingCards[0];
      const canDropEmpty = targetCol.length === 0 && lead.solitaireValue === 13;
      const top = targetCol[targetCol.length - 1];
      const canDropStack =
        targetCol.length > 0 &&
        top.faceUp &&
        isOppositeColor(lead.suit, top.suit) &&
        top.solitaireValue === lead.solitaireValue + 1;

      if (canDropEmpty || canDropStack) {
        pushSolHistory();
        setSolColumns((prev) =>
          prev.map((col, idx) => {
            if (idx === targetColIdx) return [...col, ...movingCards];
            if (source.type === 'col' && idx === source.colIdx) {
              const rem = col.slice(0, source.cardIdx);
              if (rem.length > 0) rem[rem.length - 1] = { ...rem[rem.length - 1], faceUp: true };
              return rem;
            }
            return col;
          })
        );
        if (source.type === 'waste') {
          setSolWaste(solWaste.slice(1));
        }
        setSolMoves((m) => m + 1);
        setSolSelected(null);
        nativeBridge.playSfx('card');
        appendActionLog(
          'You',
          'Magnetic Drop → Tableau',
          `${lead.rank}${lead.suit} → Column ${targetColIdx + 1}`
        );
        setSolBanner(`Snapped ${lead.rank}${lead.suit} onto Column ${targetColIdx + 1}.`);
      } else {
        nativeBridge.playSfx('error');
      }
    }
  };

  const autoPromoteEligibleToFoundations = () => {
    const curCols = solColumns.map((col) => col.map((c) => ({ ...c })));
    let curWaste = [...solWaste];
    const curFound = {
      '♠': [...solFoundations['♠']],
      '♥': [...solFoundations['♥']],
      '♦': [...solFoundations['♦']],
      '♣': [...solFoundations['♣']],
    };
    let promotedCount = 0;
    const chainLog: string[] = [];
    let keepScanning = true;

    while (keepScanning) {
      keepScanning = false;
      if (curWaste.length > 0 && canMoveToFoundation(curWaste[0], curFound)) {
        const card = curWaste[0];
        curFound[card.suit] = [...curFound[card.suit], card];
        curWaste = curWaste.slice(1);
        promotedCount++;
        chainLog.push(`${card.rank}${card.suit}`);
        keepScanning = true;
      }
      for (let i = 0; i < curCols.length; i++) {
        const col = curCols[i];
        if (col.length > 0) {
          const tip = col[col.length - 1];
          if (tip.faceUp && canMoveToFoundation(tip, curFound)) {
            curFound[tip.suit] = [...curFound[tip.suit], tip];
            const remaining = col.slice(0, -1);
            if (remaining.length > 0) {
              remaining[remaining.length - 1] = { ...remaining[remaining.length - 1], faceUp: true };
            }
            curCols[i] = remaining;
            promotedCount++;
            chainLog.push(`${tip.rank}${tip.suit}`);
            keepScanning = true;
          }
        }
      }
    }

    if (promotedCount > 0) {
      pushSolHistory();
      setSolColumns(curCols);
      setSolWaste(curWaste);
      setSolFoundations(curFound);
      setSolMoves((m) => m + promotedCount);
      setSolSelected(null);
      nativeBridge.playSfx('victory');
      spawnPopup(`+${promotedCount} Auto-Promoted!`, 'gold');
      triggerChainBanner(chainLog.slice(0, 4).map((c) => `Promoted ${c}`));
      appendActionLog('You', 'Auto-Promote Chain', `Promoted ${promotedCount} card(s) to Foundations`);
      setSolBanner(`Auto-promoted ${promotedCount} eligible card(s) to Suit Foundations!`);
      checkSolitaireWin(curFound, solMoves + promotedCount);
    } else {
      nativeBridge.playSfx('move');
      setSolBanner('No immediate Foundation promotions available · Stack Tableau or draw Stock.');
    }
  };

  const handleTableauClick = (colIdx: number, cardIdx: number) => {
    const col = solColumns[colIdx];

    if (col.length === 0) {
      if (!solSelected) return;
      let movingCards: PlayingCard[] = [];
      if (solSelected.source === 'waste') {
        if (solWaste.length > 0) movingCards = [solWaste[0]];
      } else {
        movingCards = solColumns[solSelected.source].slice(solSelected.cardIndex);
      }

      if (movingCards.length > 0 && movingCards[0].solitaireValue === 13) {
        pushSolHistory();
        const nextCols = solColumns.map((c, idx) => {
          if (idx === colIdx) return [...movingCards];
          if (idx === solSelected.source) {
            const rem = c.slice(0, solSelected.cardIndex);
            if (rem.length > 0) rem[rem.length - 1] = { ...rem[rem.length - 1], faceUp: true };
            return rem;
          }
          return c;
        });
        if (solSelected.source === 'waste') {
          setSolWaste(solWaste.slice(1));
        }
        setSolColumns(nextCols);
        setSolMoves((m) => m + 1);
        setSolSelected(null);
        nativeBridge.playSfx('card');
        appendActionLog('You', 'Moved King to Empty Column', `${movingCards[0].rank}${movingCards[0].suit} → Col ${colIdx + 1}`);
        setSolBanner(`Moved King (${movingCards[0].rank}${movingCards[0].suit}) to empty Column ${colIdx + 1}`);
      } else {
        nativeBridge.playSfx('error');
        setSolBanner('Only a King (K) or King-led stack can anchor an empty Tableau column.');
        setSolSelected(null);
      }
      return;
    }

    const clickedCard = col[cardIdx];
    if (!clickedCard) return;

    if (!clickedCard.faceUp) {
      if (cardIdx === col.length - 1) {
        pushSolHistory();
        const nextCols = solColumns.map((c, idx) =>
          idx === colIdx ? c.map((item, i) => (i === cardIdx ? { ...item, faceUp: true } : item)) : c
        );
        setSolColumns(nextCols);
        nativeBridge.playSfx('card');
        setSolBanner(`Flipped ${clickedCard.rank}${clickedCard.suit} face-up in Column ${colIdx + 1}.`);
      }
      return;
    }

    if (
      solSelected &&
      solSelected.source === colIdx &&
      solSelected.cardIndex === cardIdx &&
      cardIdx === col.length - 1 &&
      canMoveToFoundation(clickedCard)
    ) {
      handleFoundationClick(clickedCard.suit);
      return;
    }

    if (!solSelected) {
      setSolSelected({ source: colIdx, cardIndex: cardIdx });
      setSolBanner(
        `Selected ${clickedCard.rank}${clickedCard.suit}${
          cardIdx < col.length - 1 ? ` (+${col.length - 1 - cardIdx} stacked)` : ''
        } · Tap target column or Foundation!`
      );
      nativeBridge.playSfx('move');
      return;
    }

    if (solSelected.source === colIdx) {
      setSolSelected(null);
      setSolBanner('Selection cleared.');
      return;
    }

    let movingCards: PlayingCard[] = [];
    if (solSelected.source === 'waste') {
      if (solWaste.length > 0) movingCards = [solWaste[0]];
    } else {
      const srcCol = solColumns[solSelected.source];
      movingCards = srcCol.slice(solSelected.cardIndex);
    }

    if (movingCards.length === 0) {
      setSolSelected(null);
      return;
    }

    const leadCard = movingCards[0];
    const targetTop = col[col.length - 1];
    const legalOnTableau =
      targetTop &&
      targetTop.faceUp &&
      isOppositeColor(leadCard.suit, targetTop.suit) &&
      targetTop.solitaireValue === leadCard.solitaireValue + 1;

    if (legalOnTableau) {
      pushSolHistory();
      const nextCols = solColumns.map((c, idx) => {
        if (idx === colIdx) return [...c, ...movingCards];
        if (idx === solSelected.source) {
          const remaining = c.slice(0, solSelected.cardIndex);
          if (remaining.length > 0) {
            remaining[remaining.length - 1] = { ...remaining[remaining.length - 1], faceUp: true };
          }
          return remaining;
        }
        return c;
      });
      if (solSelected.source === 'waste') {
        setSolWaste(solWaste.slice(1));
      }
      setSolColumns(nextCols);
      setSolMoves((m) => m + 1);
      setSolSelected(null);
      nativeBridge.playSfx('card');
      appendActionLog(
        'You',
        'Stacked Tableau',
        `${leadCard.rank}${leadCard.suit} onto ${targetTop.rank}${targetTop.suit} (Col ${colIdx + 1})`
      );
      setSolBanner(
        `Stacked ${leadCard.rank}${leadCard.suit}${
          movingCards.length > 1 ? ` (+${movingCards.length - 1} cards)` : ''
        } onto ${targetTop.rank}${targetTop.suit}`
      );
    } else {
      setSolSelected({ source: colIdx, cardIndex: cardIdx });
      nativeBridge.playSfx('move');
      setSolBanner(`Switched selection to ${clickedCard.rank}${clickedCard.suit}.`);
    }
  };

  // ==================== 2. 5-CARD DRAW POKER STATE (NEW CLASSIC MODE) ====================
  const [drawDeck, setDrawDeck] = useState<PlayingCard[]>([]);
  const [drawDiscardPile, setDrawDiscardPile] = useState<PlayingCard[]>([]);
  const [drawPlayerHand, setDrawPlayerHand] = useState<PlayingCard[]>([]);
  const [drawOpponentHand, setDrawOpponentHand] = useState<PlayingCard[]>([]);
  const [drawHeldIds, setDrawHeldIds] = useState<string[]>([]);
  const [drawPot, setDrawPot] = useState<number>(100);
  const [drawPhase, setDrawPhase] = useState<'bet_1' | 'mulligan_draw' | 'bet_2' | 'showdown'>('bet_1');
  const [drawStatus, setDrawStatus] = useState<string>(
    '5-Card Draw dealt · Place opening bet before the Hold/Mulligan Redraw phase!'
  );
  const [opponentDrawSummary, setOpponentDrawSummary] = useState<string>('Holding 5 opening cards');

  const startFiveCardDrawHand = useCallback(() => {
    const d = createStandardDeck();
    const pHand = d.slice(0, 5);
    const oHand = d.slice(5, 10);
    setDrawDeck(d.slice(10));
    setDrawDiscardPile([]);
    setDrawPlayerHand(pHand);
    setDrawOpponentHand(oHand);
    // Pre-hold any natural pair to delight the player
    const autoHeld: string[] = [];
    const counts: Record<number, PlayingCard[]> = {};
    pHand.forEach((c) => {
      counts[c.value] = [...(counts[c.value] || []), c];
    });
    Object.values(counts).forEach((grp) => {
      if (grp.length >= 2) grp.forEach((c) => autoHeld.push(c.id));
    });
    setDrawHeldIds(autoHeld);
    setDrawPot(100);
    setDrawPhase('bet_1');
    setOpponentDrawSummary('Evaluating opening 5-card hand');
    setDrawStatus('New 5-Card Draw hand · Call or Raise to enter the Card-Hold Redraw stage!');
    triggerTableShuffle();
    nativeBridge.playSfx('card');
    broadcastMove('draw_poker', { phase: 'bet_1', pot: 100 });
  }, [broadcastMove, triggerTableShuffle]);

  useEffect(() => {
    startFiveCardDrawHand();
  }, [startFiveCardDrawHand]);

  const toggleDrawHoldCard = (cardId: string) => {
    if (drawPhase !== 'mulligan_draw') return;
    nativeBridge.playSfx('move');
    setDrawHeldIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  };

  const advanceFiveCardBetting = (betAdded: number) => {
    const nextPot = drawPot + betAdded * 2;
    setDrawPot(nextPot);
    nativeBridge.playSfx(betAdded > 0 ? 'chip' : 'card');
    if (betAdded > 0) {
      spawnPopup(`+${betAdded * 2} Pot Escrow`, 'amber');
    }

    if (drawPhase === 'bet_1') {
      setDrawPhase('mulligan_draw');
      setDrawStatus('HOLD & REDRAW PHASE · Tap cards to lock HOLD, then click Redraw Unheld!');
      appendActionLog(
        'You',
        betAdded > 0 ? `Raised +${betAdded}` : 'Checked Opening Round',
        `Pot now ${nextPot} Chips · Entered Draw Phase`
      );
      broadcastMove('draw_poker', { phase: 'mulligan_draw', pot: nextPot });
      return;
    }

    if (drawPhase === 'bet_2') {
      setDrawPhase('showdown');
      const pEval = evaluateHoldemHand(drawPlayerHand);
      const oEval = evaluateHoldemHand(drawOpponentHand);
      const won = pEval.score >= oEval.score;
      const delta = won ? Math.floor(nextPot / 2) : -Math.floor(nextPot / 2);

      triggerImpactShake();
      triggerChainBanner([
        `Your Hand: ${pEval.label}`,
        `Viktor: ${oEval.label}`,
        won ? `You Win +${delta} Chips` : `Viktor Claims Pot`,
      ]);

      if (won) {
        setDrawStatus(`Showdown Victory! Your ${pEval.label} beats Viktor's ${oEval.label} (+${delta} chips)`);
        spawnPopup(`+${delta} CHIPS · ${pEval.label.toUpperCase()}!`, 'gold');
        nativeBridge.playSfx('victory');
      } else {
        setDrawStatus(`Viktor wins showdown with ${oEval.label} vs your ${pEval.label} (${delta} chips)`);
        spawnPopup(`${delta} CHIPS · ${oEval.label}`, 'rose');
        nativeBridge.playSfx('error');
      }
      appendActionLog(
        won ? 'You' : 'Viktor_Node',
        '5-Card Draw Showdown',
        `${pEval.label} vs ${oEval.label}`,
        `${delta >= 0 ? '+' : ''}${delta} Chips`
      );

      triggerGameComplete({
        gameId: 'draw_poker',
        gameTitle: '5-Card Draw Poker',
        gameTypeLedger: 'DRAW_POKER',
        outcome: won ? 'win' : 'loss',
        headline: won ? `5-Card Showdown Win — ${pEval.label}!` : `Showdown Defeat — ${oEval.label}`,
        subheadline: won
          ? `Your ${pEval.label} outranked Viktor's ${oEval.label} after the draw!`
          : `Viktor drew into ${oEval.label} against your ${pEval.label}.`,
        chipsDelta: delta,
        stats: [
          { label: 'Your 5-Card Hand', value: pEval.label },
          { label: 'Opponent Hand', value: oEval.label },
          { label: 'Final Pot', value: `${nextPot} Chips` },
        ],
        statePayload: { playerHand: pEval.label, opponentHand: oEval.label, pot: nextPot },
        onPlayAgain: startFiveCardDrawHand,
      });
    }
  };

  const executeFiveCardMulliganDraw = (keepAllFive = false) => {
    if (drawPhase !== 'mulligan_draw') return;
    let deckCursor = [...drawDeck];
    const tossed: PlayingCard[] = [];

    const nextPlayerHand = keepAllFive
      ? [...drawPlayerHand]
      : drawPlayerHand.map((card) => {
          if (drawHeldIds.includes(card.id)) return card;
          tossed.push(card);
          const replacement = deckCursor[0];
          deckCursor = deckCursor.slice(1);
          return replacement || card;
        });

    // Opponent AI smart draw
    const aiHoldSet = chooseAiDrawHoldIndices(drawOpponentHand);
    let aiDrawnCount = 0;
    const nextOpponentHand = drawOpponentHand.map((card, idx) => {
      if (aiHoldSet.has(idx)) return card;
      tossed.push(card);
      aiDrawnCount++;
      const replacement = deckCursor[0];
      deckCursor = deckCursor.slice(1);
      return replacement || card;
    });

    const playerRedrawnCount = keepAllFive
      ? 0
      : drawPlayerHand.length - drawHeldIds.length;

    setDrawPlayerHand(nextPlayerHand);
    setDrawOpponentHand(nextOpponentHand);
    setDrawDeck(deckCursor);
    setDrawDiscardPile((prev) => [...tossed, ...prev]);
    setDrawPhase('bet_2');
    setOpponentDrawSummary(
      aiDrawnCount === 0
        ? 'Stood Pat (Kept all 5 cards)'
        : `Discarded & redrew ${aiDrawnCount} card(s)`
    );
    setDrawStatus(
      `Redrew ${playerRedrawnCount} card(s) · Viktor redrew ${aiDrawnCount} · Final Betting Street!`
    );
    nativeBridge.playSfx('card');
    triggerChainBanner([
      playerRedrawnCount === 0 ? 'You Stood Pat' : `You Redrew ${playerRedrawnCount}`,
      aiDrawnCount === 0 ? 'Viktor Stood Pat' : `Viktor Redrew ${aiDrawnCount}`,
      'Final Showdown Betting',
    ]);
    appendActionLog(
      'You',
      'Draw Phase Complete',
      `Redrew ${playerRedrawnCount} card(s); Viktor redrew ${aiDrawnCount}`
    );
    broadcastMove('draw_poker', {
      phase: 'bet_2',
      playerRedrawnCount,
      aiDrawnCount,
    });
  };

  const foldFiveCardDraw = () => {
    setDrawPhase('showdown');
    const loss = Math.max(50, Math.floor(drawPot / 3));
    setDrawStatus(`Folded 5-Card Draw hand (-${loss} chips)`);
    spawnPopup(`-${loss} CHIPS (FOLD)`, 'rose');
    nativeBridge.playSfx('card');
    appendActionLog('You', 'Folded 5-Card Draw', `Forfeited pot (${drawPot} Chips)`, `-${loss} Chips`);
    triggerGameComplete({
      gameId: 'draw_poker',
      gameTitle: '5-Card Draw Poker',
      gameTypeLedger: 'DRAW_POKER',
      outcome: 'loss',
      headline: '5-Card Hand Folded',
      subheadline: `Folded during ${drawPhase.toUpperCase()} to conserve bankroll.`,
      chipsDelta: -loss,
      stats: [
        { label: 'Phase Folded', value: drawPhase.toUpperCase() },
        { label: 'Pot Size', value: `${drawPot} Chips` },
      ],
      statePayload: { drawPhase, drawPot },
      onPlayAgain: startFiveCardDrawHand,
    });
  };

  // ==================== 3. TEXAS HOLD'EM POKER STATE ====================
  const [pokerDeck, setPokerDeck] = useState<PlayingCard[]>([]);
  const [playerHole, setPlayerHole] = useState<PlayingCard[]>([]);
  const [opponentHole, setOpponentHole] = useState<PlayingCard[]>([]);
  const [community, setCommunity] = useState<PlayingCard[]>([]);
  const [pot, setPot] = useState<number>(100);
  const [street, setStreet] = useState<'preflop' | 'flop' | 'turn' | 'river' | 'showdown'>('preflop');
  const [pokerStatus, setPokerStatus] = useState<string>('Pre-Flop dealt. Call, Raise, or Fold.');

  const startPokerHand = useCallback(() => {
    const d = createStandardDeck();
    const pHole = [d[0], d[1]];
    const oHole = [d[2], d[3]];
    setPokerDeck(d.slice(4));
    setPlayerHole(pHole);
    setOpponentHole(oHole);
    setCommunity([]);
    setPot(100);
    setStreet('preflop');
    setPokerStatus('New Hold’em hand dealt · Blinds posted (100 Pot)');
    triggerTableShuffle();
    nativeBridge.playSfx('card');
    broadcastMove('poker', { street: 'preflop', pot: 100, communityCount: 0 });
  }, [broadcastMove, triggerTableShuffle]);

  useEffect(() => {
    startPokerHand();
  }, [startPokerHand]);

  const advancePokerStreet = (betAdded: number) => {
    const nextPot = pot + betAdded * 2;
    setPot(nextPot);
    nativeBridge.playSfx(betAdded > 0 ? 'chip' : 'card');
    if (betAdded > 0) {
      spawnPopup(`+${betAdded * 2} Pot`, 'amber');
    }

    if (street === 'preflop') {
      const flop = pokerDeck.slice(0, 3);
      setCommunity(flop);
      setStreet('flop');
      setPokerStatus(`Flop dealt · Viktor matches ${betAdded} chips`);
      appendActionLog('Dealer', 'Flop Revealed', flop.map((c) => `${c.rank}${c.suit}`).join(' '));
      broadcastMove('poker', { street: 'flop', pot: nextPot });
    } else if (street === 'flop') {
      const turnCards = [...community, pokerDeck[3]];
      setCommunity(turnCards);
      setStreet('turn');
      setPokerStatus(`Turn card revealed · Pot at ${nextPot} chips`);
      appendActionLog('Dealer', 'Turn Card', `${pokerDeck[3].rank}${pokerDeck[3].suit}`);
      broadcastMove('poker', { street: 'turn', pot: nextPot });
    } else if (street === 'turn') {
      const riverCards = [...community, pokerDeck[4]];
      setCommunity(riverCards);
      setStreet('river');
      setPokerStatus(`River card on felt · Final betting street`);
      appendActionLog('Dealer', 'River Card', `${pokerDeck[4].rank}${pokerDeck[4].suit}`);
      broadcastMove('poker', { street: 'river', pot: nextPot });
    } else if (street === 'river') {
      setStreet('showdown');
      const pEval = evaluateHoldemHand([...playerHole, ...community]);
      const oEval = evaluateHoldemHand([...opponentHole, ...community]);
      const won = pEval.score >= oEval.score;
      const delta = won ? Math.floor(nextPot / 2) : -Math.floor(nextPot / 2);

      triggerImpactShake();
      triggerChainBanner([
        `You: ${pEval.label}`,
        `Viktor: ${oEval.label}`,
        won ? `+${delta} Chips Won` : `Viktor Wins Pot`,
      ]);

      if (won) {
        setPokerStatus(`Victory! Your ${pEval.label} beats Viktor's ${oEval.label} (+${delta} chips)`);
        spawnPopup(`+${delta} CHIPS · ${pEval.label}!`, 'gold');
        nativeBridge.playSfx('victory');
      } else {
        setPokerStatus(`Viktor wins showdown with ${oEval.label} vs your ${pEval.label} (${delta} chips)`);
        spawnPopup(`${delta} CHIPS`, 'rose');
        nativeBridge.playSfx('error');
      }
      appendActionLog(
        won ? 'You' : 'Viktor_Node',
        'Hold’em Showdown',
        `${pEval.label} vs ${oEval.label}`,
        `${delta >= 0 ? '+' : ''}${delta} Chips`
      );

      triggerGameComplete({
        gameId: 'poker',
        gameTitle: 'Texas Hold’em Poker',
        gameTypeLedger: 'POKER',
        outcome: won ? 'win' : 'loss',
        headline: won ? `Showdown Victory — ${pEval.label}!` : `Showdown Lost — ${oEval.label}`,
        subheadline: won
          ? `Your ${pEval.label} defeated Viktor's ${oEval.label} to claim the ${nextPot}-chip pot.`
          : `Viktor's ${oEval.label} edged out your ${pEval.label} at the River showdown.`,
        chipsDelta: delta,
        stats: [
          { label: 'Your Best 5-Card Hand', value: pEval.label },
          { label: 'Opponent Hand', value: oEval.label },
          { label: 'Total Pot Size', value: `${nextPot} Chips` },
        ],
        statePayload: { playerHand: pEval.label, opponentHand: oEval.label, pot: nextPot },
        onPlayAgain: startPokerHand,
      });
    }
  };

  const foldPokerHand = () => {
    setStreet('showdown');
    const loss = Math.max(50, Math.floor(pot / 3));
    setPokerStatus(`You folded · Viktor claims pot (-${loss} chips)`);
    spawnPopup(`-${loss} CHIPS (FOLD)`, 'rose');
    nativeBridge.playSfx('card');
    appendActionLog('You', 'Folded Hold’em Hand', `Street: ${street.toUpperCase()}`, `-${loss} Chips`);
    triggerGameComplete({
      gameId: 'poker',
      gameTitle: 'Texas Hold’em Poker',
      gameTypeLedger: 'POKER',
      outcome: 'loss',
      headline: 'Hand Folded',
      subheadline: `You folded on the ${street.toUpperCase()} street to preserve bankroll.`,
      chipsDelta: -loss,
      stats: [
        { label: 'Street Folded', value: street.toUpperCase() },
        { label: 'Pot Forfeited', value: `${pot} Chips` },
      ],
      statePayload: { street, pot },
      onPlayAgain: startPokerHand,
    });
  };

  // ==================== 4. CASINO BLACKJACK (21) STATE ====================
  const [bjDeck, setBjDeck] = useState<PlayingCard[]>([]);
  const [bjPlayer, setBjPlayer] = useState<PlayingCard[]>([]);
  const [bjDealer, setBjDealer] = useState<PlayingCard[]>([]);
  const [bjBet, setBjBet] = useState<number>(100);
  const [bjDoubled, setBjDoubled] = useState<boolean>(false);
  const [bjPhase, setBjPhase] = useState<'playing' | 'settled'>('playing');
  const [bjBanner, setBjBanner] = useState<string>('Your action: Hit, Stand, or Double Down.');

  const dealBlackjack = useCallback(
    (wager = bjBet) => {
      const d = createStandardDeck();
      const pCards = [d[0], d[2]];
      const dCards = [d[1], d[3]];
      setBjDeck(d.slice(4));
      setBjPlayer(pCards);
      setBjDealer(dCards);
      setBjDoubled(false);
      setBjPhase('playing');
      triggerTableShuffle();
      nativeBridge.playSfx('card');

      const pScore = blackjackHandTotal(pCards).total;
      if (pScore === 21) {
        setBjPhase('settled');
        const winAmt = Math.floor(wager * 1.5);
        setBjBanner(`Natural Blackjack 21! Paid 3:2 (+${winAmt} chips, +1 Daily Pt)`);
        spawnPopup(`NATURAL 21! +${winAmt} CHIPS`, 'gold');
        triggerImpactShake();
        nativeBridge.playSfx('victory');
        appendActionLog('You', 'Natural Blackjack 21', 'Paid 3:2', `+${winAmt} Chips`);
        triggerGameComplete({
          gameId: 'blackjack',
          gameTitle: 'Casino Blackjack 21',
          gameTypeLedger: 'BLACKJACK',
          outcome: 'win',
          headline: 'Natural Blackjack 21! (Paid 3:2)',
          subheadline: `Dealt an immediate 21 (${pCards[0].rank}${pCards[0].suit} + ${pCards[1].rank}${pCards[1].suit})!`,
          chipsDelta: winAmt,
          stats: [
            { label: 'Your Hand Total', value: '21 (Natural)' },
            { label: 'Payout Odds', value: '3 : 2' },
            { label: 'Wager', value: `${wager} Chips` },
          ],
          statePayload: { playerTotal: 21 },
          onPlayAgain: () => dealBlackjack(wager),
        });
      } else {
        setBjBanner(`Wager ${wager} chips · Dealer shows ${dCards[0].rank}${dCards[0].suit}`);
      }
    },
    [appendActionLog, bjBet, spawnPopup, triggerGameComplete, triggerImpactShake, triggerTableShuffle]
  );

  useEffect(() => {
    dealBlackjack(100);
  }, []);

  const standBlackjack = (customHand?: PlayingCard[], customWager?: number) => {
    const activeHand = customHand || bjPlayer;
    const wager = customWager || bjBet;
    const dHand = [...bjDealer];
    let deckCopy = [...bjDeck];
    const dealerDraws: string[] = [];
    while (blackjackHandTotal(dHand).total < 17 && deckCopy.length > 0) {
      dHand.push(deckCopy[0]);
      dealerDraws.push(`${deckCopy[0].rank}${deckCopy[0].suit}`);
      deckCopy = deckCopy.slice(1);
    }
    setBjDealer(dHand);
    setBjDeck(deckCopy);
    setBjPhase('settled');

    const pTotal = blackjackHandTotal(activeHand).total;
    const dTotal = blackjackHandTotal(dHand).total;

    triggerChainBanner([
      `You Stand on ${pTotal}`,
      dealerDraws.length > 0 ? `Dealer Draws ${dealerDraws.join(', ')}` : `Dealer Reveals ${dTotal}`,
      dTotal > 21 ? `Dealer Busts (${dTotal})!` : `Dealer Stands on ${dTotal}`,
    ]);

    if (dTotal > 21 || pTotal > dTotal) {
      setBjBanner(
        `You win! ${pTotal} beats Dealer ${dTotal > 21 ? `Bust (${dTotal})` : dTotal} (+${wager} chips)`
      );
      spawnPopup(`+${wager} CHIPS · WIN!`, 'gold');
      triggerImpactShake();
      nativeBridge.playSfx('victory');
      appendActionLog('You', 'Blackjack Victory', `${pTotal} vs Dealer ${dTotal}`, `+${wager} Chips`);
      triggerGameComplete({
        gameId: 'blackjack',
        gameTitle: 'Casino Blackjack 21',
        gameTypeLedger: 'BLACKJACK',
        outcome: 'win',
        headline: dTotal > 21 ? `Dealer Busts at ${dTotal} — You Win!` : `Victory! ${pTotal} Beats Dealer ${dTotal}`,
        subheadline: `Your hand of ${pTotal} defeated the Dealer's ${dTotal}.`,
        chipsDelta: wager,
        stats: [
          { label: 'Your Hand Total', value: `${pTotal}` },
          { label: 'Dealer Hand Total', value: dTotal > 21 ? `${dTotal} (BUST)` : `${dTotal}` },
          { label: 'Wager Won', value: `+${wager} Chips` },
        ],
        statePayload: { pTotal, dTotal },
        onPlayAgain: () => dealBlackjack(100),
      });
    } else if (pTotal < dTotal) {
      setBjBanner(`Dealer wins with ${dTotal} vs your ${pTotal} (-${wager} chips)`);
      spawnPopup(`-${wager} CHIPS`, 'rose');
      triggerImpactShake();
      nativeBridge.playSfx('error');
      appendActionLog('Dealer', 'Blackjack Dealer Win', `Dealer ${dTotal} vs ${pTotal}`, `-${wager} Chips`);
      triggerGameComplete({
        gameId: 'blackjack',
        gameTitle: 'Casino Blackjack 21',
        gameTypeLedger: 'BLACKJACK',
        outcome: 'loss',
        headline: `Dealer Wins (${dTotal} vs ${pTotal})`,
        subheadline: `Dealer stood on ${dTotal} against your ${pTotal}.`,
        chipsDelta: -wager,
        stats: [
          { label: 'Your Hand Total', value: `${pTotal}` },
          { label: 'Dealer Hand Total', value: `${dTotal}` },
          { label: 'Wager Lost', value: `-${wager} Chips` },
        ],
        statePayload: { pTotal, dTotal },
        onPlayAgain: () => dealBlackjack(100),
      });
    } else {
      setBjBanner(`Push at ${pTotal} · Wager returned`);
      spawnPopup(`PUSH AT ${pTotal}`, 'amber');
      nativeBridge.playSfx('chip');
      appendActionLog('Dealer', 'Blackjack Push', `Tied at ${pTotal}`, '0 Chips');
      triggerGameComplete({
        gameId: 'blackjack',
        gameTitle: 'Casino Blackjack 21',
        gameTypeLedger: 'BLACKJACK',
        outcome: 'draw',
        headline: `Standoff Push at ${pTotal}`,
        subheadline: `Both you and the Dealer tied at ${pTotal}. Your ${wager}-chip wager is returned.`,
        chipsDelta: 0,
        stats: [
          { label: 'Your Total', value: `${pTotal}` },
          { label: 'Dealer Total', value: `${dTotal}` },
          { label: 'Result', value: 'Push (0 Delta)' },
        ],
        statePayload: { pTotal, dTotal },
        onPlayAgain: () => dealBlackjack(100),
      });
    }
  };

  const hitBlackjack = () => {
    if (bjPhase !== 'playing' || bjDeck.length === 0) return;
    const nextCard = bjDeck[0];
    const nextHand = [...bjPlayer, nextCard];
    setBjDeck(bjDeck.slice(1));
    setBjPlayer(nextHand);
    nativeBridge.playSfx('card');

    const total = blackjackHandTotal(nextHand).total;
    appendActionLog('You', 'Hit Card', `Drew ${nextCard.rank}${nextCard.suit} → Total ${total}`);

    if (total > 21) {
      setBjPhase('settled');
      setBjBanner(`Bust at ${total} (-${bjBet} chips)`);
      spawnPopup(`BUST AT ${total}! (-${bjBet})`, 'rose');
      triggerImpactShake();
      nativeBridge.playSfx('error');
      triggerGameComplete({
        gameId: 'blackjack',
        gameTitle: 'Casino Blackjack 21',
        gameTypeLedger: 'BLACKJACK',
        outcome: 'loss',
        headline: `Busted at ${total}`,
        subheadline: `Drawing ${nextCard.rank}${nextCard.suit} pushed your hand over 21.`,
        chipsDelta: -bjBet,
        stats: [
          { label: 'Your Hand Total', value: `${total} (BUST)` },
          { label: 'Last Card Drawn', value: `${nextCard.rank}${nextCard.suit}` },
          { label: 'Wager', value: `-${bjBet} Chips` },
        ],
        statePayload: { playerTotal: total },
        onPlayAgain: () => dealBlackjack(100),
      });
    } else if (total === 21) {
      standBlackjack(nextHand, bjBet);
    }
  };

  const doubleDownBlackjack = () => {
    if (bjPhase !== 'playing' || bjPlayer.length !== 2 || bjDeck.length === 0) return;
    const doubledWager = bjBet * 2;
    setBjBet(doubledWager);
    setBjDoubled(true);
    const nextCard = bjDeck[0];
    const nextHand = [...bjPlayer, nextCard];
    setBjDeck(bjDeck.slice(1));
    setBjPlayer(nextHand);
    const total = blackjackHandTotal(nextHand).total;
    appendActionLog('You', 'Double Down (2×)', `Wager ${doubledWager} · Drew ${nextCard.rank}${nextCard.suit}`);

    if (total > 21) {
      setBjPhase('settled');
      setBjBanner(`Double Down Bust at ${total} (-${doubledWager} chips)`);
      spawnPopup(`2× BUST AT ${total} (-${doubledWager})`, 'rose');
      triggerImpactShake();
      nativeBridge.playSfx('error');
      triggerGameComplete({
        gameId: 'blackjack',
        gameTitle: 'Casino Blackjack 21',
        gameTypeLedger: 'BLACKJACK',
        outcome: 'loss',
        headline: `Double Down Bust at ${total}`,
        subheadline: `Doubled wager to ${doubledWager} chips and drew ${nextCard.rank}${nextCard.suit}.`,
        chipsDelta: -doubledWager,
        stats: [
          { label: 'Your Hand Total', value: `${total} (BUST)` },
          { label: 'Doubled Wager', value: `-${doubledWager} Chips` },
        ],
        statePayload: { total },
        onPlayAgain: () => {
          setBjBet(100);
          dealBlackjack(100);
        },
      });
    } else {
      standBlackjack(nextHand, doubledWager);
    }
  };

  // ==================== 5. UNO COMPETITIVE SHEDDING STATE ====================
  const [unoDeck, setUnoDeck] = useState<UnoCard[]>([]);
  const [unoDiscardHistory, setUnoDiscardHistory] = useState<UnoCard[]>([]);
  const [unoPlayerHand, setUnoPlayerHand] = useState<UnoCard[]>([]);
  const [unoBotHand, setUnoBotHand] = useState<UnoCard[]>([]);
  const [unoTopCard, setUnoTopCard] = useState<UnoCard>({ id: 'init', color: 'Y', label: '7' });
  const [unoActiveColor, setUnoActiveColor] = useState<'R' | 'G' | 'B' | 'Y'>('Y');
  const [unoPreferredWildColor, setUnoPreferredWildColor] = useState<'R' | 'G' | 'B' | 'Y'>('Y');
  const [unoTurn, setUnoTurn] = useState<'player' | 'bot'>('player');
  const [unoCalled, setUnoCalled] = useState<boolean>(false);
  const [unoMulliganMode, setUnoMulliganMode] = useState<boolean>(false);
  const [unoMulliganUsed, setUnoMulliganUsed] = useState<boolean>(false);
  const [unoMulliganIds, setUnoMulliganIds] = useState<string[]>([]);
  const [unoStatus, setUnoStatus] = useState<string>('Match color, number, or play a Wild card.');

  const initUnoMatch = useCallback(() => {
    const d = createUnoDeck();
    const pHand = d.slice(0, 7);
    const bHand = d.slice(7, 14);
    const firstNonWild = d.slice(14).find((c) => c.color !== 'W') || {
      id: 'start_y7',
      color: 'Y' as const,
      label: '7',
    };
    setUnoDeck(d.slice(15));
    setUnoDiscardHistory([firstNonWild]);
    setUnoPlayerHand(pHand);
    setUnoBotHand(bHand);
    setUnoTopCard(firstNonWild);
    setUnoActiveColor(firstNonWild.color === 'W' ? 'Y' : firstNonWild.color);
    setUnoTurn('player');
    setUnoCalled(false);
    setUnoMulliganMode(false);
    setUnoMulliganUsed(false);
    setUnoMulliganIds([]);
    setUnoStatus('UNO Blitz started · Play a highlighted card or use Opening Mulligan!');
    triggerTableShuffle();
    nativeBridge.playSfx('card');
  }, [triggerTableShuffle]);

  useEffect(() => {
    initUnoMatch();
  }, [initUnoMatch]);

  const executeUnoOpeningMulligan = () => {
    if (unoMulliganUsed || unoMulliganIds.length === 0) {
      setUnoMulliganMode(false);
      return;
    }
    let deckCopy = [...unoDeck];
    const returned: UnoCard[] = [];
    const nextHand = unoPlayerHand.map((c) => {
      if (!unoMulliganIds.includes(c.id)) return c;
      returned.push(c);
      const drawn = deckCopy[0];
      deckCopy = deckCopy.slice(1);
      return drawn || c;
    });
    deckCopy.push(...returned);
    setUnoPlayerHand(nextHand);
    setUnoDeck(deckCopy);
    setUnoMulliganMode(false);
    setUnoMulliganUsed(true);
    setUnoMulliganIds([]);
    triggerTableShuffle();
    nativeBridge.playSfx('card');
    spawnPopup(`Mulligan Redrew ${returned.length} Cards!`, 'amber');
    appendActionLog('You', 'Opening Mulligan', `Swapped ${returned.length} card(s)`);
    setUnoStatus(`Redrew ${returned.length} opening card(s) · Your turn to play!`);
  };

  const canPlayUnoCard = (card: UnoCard) => {
    if (card.color === 'W') return true;
    return card.color === unoActiveColor || card.label === unoTopCard.label;
  };

  const playUnoCard = (card: UnoCard, chosenColor?: 'R' | 'G' | 'B' | 'Y') => {
    if (unoTurn !== 'player' || !canPlayUnoCard(card)) {
      nativeBridge.playSfx('error');
      return;
    }

    setUnoMulliganUsed(true);
    setUnoMulliganMode(false);

    const nextPlayerHand = unoPlayerHand.filter((c) => c.id !== card.id);
    const nextColor = card.color === 'W' ? chosenColor || unoPreferredWildColor : card.color;
    setUnoPlayerHand(nextPlayerHand);
    setUnoTopCard(card);
    setUnoDiscardHistory((prev) => [card, ...prev]);
    setUnoActiveColor(nextColor);
    nativeBridge.playSfx('uno');
    appendActionLog('You', `Played ${card.color} ${card.label}`, `Active Suit → ${nextColor}`);

    if (nextPlayerHand.length === 0) {
      setUnoStatus('UNO Victory! You shed all cards (+250 chips, +1 Daily Pt)');
      spawnPopup('+250 CHIPS · UNO VICTORY!', 'gold');
      triggerImpactShake();
      nativeBridge.playSfx('victory');
      triggerGameComplete({
        gameId: 'uno',
        gameTitle: 'UNO Competitive Shedding',
        gameTypeLedger: 'UNO',
        outcome: 'win',
        headline: 'UNO Blitz Victory!',
        subheadline: `You shed your final card (${card.color}-${card.label}) while the opponent still held ${unoBotHand.length} cards!`,
        chipsDelta: 250,
        stats: [
          { label: 'Winning Card', value: `${card.color} ${card.label}` },
          { label: 'Opponent Cards Left', value: `${unoBotHand.length} Cards` },
          { label: 'UNO Called', value: unoCalled ? 'Verified' : 'Auto-Verified' },
        ],
        statePayload: { finalCard: `${card.color}-${card.label}` },
        onPlayAgain: initUnoMatch,
      });
      return;
    }

    const nextBotHand = [...unoBotHand];
    let nextDeck = [...unoDeck];
    if (card.label === '+2') {
      nextBotHand.push(...nextDeck.slice(0, 2));
      nextDeck = nextDeck.slice(2);
      triggerImpactShake();
      spawnPopup('PEER DRAWS +2!', 'gold');
      triggerChainBanner([`Played ${card.color} +2`, 'Peer Draws 2 Penalty Cards']);
    } else if (card.label === '+4') {
      nextBotHand.push(...nextDeck.slice(0, 4));
      nextDeck = nextDeck.slice(4);
      triggerImpactShake();
      spawnPopup('WILD +4 IMPACT!', 'gold');
      triggerChainBanner([
        'Played Wild +4',
        `Suit Locked: ${nextColor}`,
        'Peer Draws 4 Cards',
      ]);
    }
    setUnoBotHand(nextBotHand);
    setUnoDeck(nextDeck);

    broadcastMove('uno', { topCard: `${nextColor}-${card.label}`, playerCardsLeft: nextPlayerHand.length });

    if (card.label === 'Skip' || card.label === 'Reverse') {
      spawnPopup(`${card.label.toUpperCase()} · EXTRA TURN!`, 'amber');
      triggerChainBanner([`Played ${card.label}`, 'Peer Skipped', 'Priority Returned to You']);
      setUnoStatus(`Played ${card.label}! Opponent skipped — chain another turn!`);
      return;
    }

    setUnoTurn('bot');
    setUnoStatus('Opponent peer scanning hand...');
    window.setTimeout(() => {
      const playable = nextBotHand.find(
        (c) => c.color === 'W' || c.color === nextColor || c.label === card.label
      );
      if (playable) {
        const remainingBot = nextBotHand.filter((c) => c.id !== playable.id);
        const botChosenColor: 'R' | 'G' | 'B' | 'Y' =
          playable.color === 'W'
            ? (['R', 'G', 'B', 'Y'][Math.floor(Math.random() * 4)] as 'R' | 'G' | 'B' | 'Y')
            : playable.color;
        setUnoBotHand(remainingBot);
        setUnoTopCard(playable);
        setUnoDiscardHistory((prev) => [playable, ...prev]);
        setUnoActiveColor(botChosenColor);
        nativeBridge.playSfx('card');
        appendActionLog('Peer_Bot', `Played ${playable.color} ${playable.label}`, `Suit: ${botChosenColor}`);

        if (playable.label === '+2' || playable.label === '+4') {
          const drawCount = playable.label === '+4' ? 4 : 2;
          setUnoPlayerHand((prev) => [...prev, ...nextDeck.slice(0, drawCount)]);
          setUnoDeck((prev) => prev.slice(drawCount));
          triggerImpactShake();
          spawnPopup(`+${drawCount} PENALTY DRAW`, 'rose');
        }

        if (remainingBot.length === 0) {
          setUnoStatus('Opponent shed final card · Match lost (-150 chips)');
          nativeBridge.playSfx('error');
          triggerGameComplete({
            gameId: 'uno',
            gameTitle: 'UNO Competitive Shedding',
            gameTypeLedger: 'UNO',
            outcome: 'loss',
            headline: 'Opponent Shed Final Card',
            subheadline: `Peer played ${botChosenColor} ${playable.label} to empty their hand.`,
            chipsDelta: -150,
            stats: [
              { label: 'Your Cards Remaining', value: `${nextPlayerHand.length}` },
              { label: 'Final Opponent Card', value: `${botChosenColor} ${playable.label}` },
            ],
            statePayload: { botWon: true },
            onPlayAgain: initUnoMatch,
          });
          return;
        }
        setUnoStatus(`Opponent played ${botChosenColor} ${playable.label} · Your turn`);
      } else if (nextDeck.length > 0) {
        setUnoBotHand([...nextBotHand, nextDeck[0]]);
        setUnoDeck(nextDeck.slice(1));
        appendActionLog('Peer_Bot', 'Drew 1 Card', 'No playable match');
        setUnoStatus('Opponent drew 1 card from deck · Your turn');
      }
      setUnoTurn('player');
    }, 620);
  };

  const drawUnoCardForPlayer = () => {
    if (unoTurn !== 'player') return;
    if (unoDeck.length === 0 && unoDiscardHistory.length > 1) {
      const recycled = unoDiscardHistory.slice(1);
      setUnoDeck(recycled);
      setUnoDiscardHistory([unoTopCard]);
      triggerTableShuffle();
      setUnoStatus('Recycled UNO discard stack into Draw Stock!');
      return;
    }
    if (unoDeck.length === 0) return;
    const drawn = unoDeck[0];
    setUnoPlayerHand([...unoPlayerHand, drawn]);
    setUnoDeck(unoDeck.slice(1));
    nativeBridge.playSfx('card');
    appendActionLog('You', 'Drew UNO Card', `${drawn.color} ${drawn.label}`);
    setUnoStatus(`Drew ${drawn.color} ${drawn.label}`);
  };

  // ==================== BURNING ROPE COUNTDOWN EFFECT (COMPETITIVE MODES ONLY) ====================
  const isCompetitiveMode =
    activeGame === 'draw_poker' ||
    activeGame === 'poker' ||
    activeGame === 'blackjack' ||
    activeGame === 'uno';

  const isPlayerDecisionActive =
    !winMenuPayload &&
    ((activeGame === 'draw_poker' && drawPhase !== 'showdown') ||
      (activeGame === 'poker' && street !== 'showdown') ||
      (activeGame === 'blackjack' && bjPhase === 'playing') ||
      (activeGame === 'uno' && unoTurn === 'player'));

  // Reset rope timer whenever game, phase, or move state shifts
  useEffect(() => {
    setRopeSecondsLeft(ROPE_DURATION_SECONDS);
  }, [
    activeGame,
    drawPhase,
    drawPot,
    street,
    pot,
    bjPhase,
    bjPlayer.length,
    unoTurn,
    unoPlayerHand.length,
  ]);

  useEffect(() => {
    if (!isCompetitiveMode || !ropeEnabled || !isPlayerDecisionActive) return;
    const id = window.setInterval(() => {
      setRopeSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isCompetitiveMode, ropeEnabled, isPlayerDecisionActive]);

  useEffect(() => {
    if (!isCompetitiveMode || !ropeEnabled || !isPlayerDecisionActive) return;
    if (ropeSecondsLeft > 0) return;

    // Safe automatic action on rope timeout
    setRopeSecondsLeft(ROPE_DURATION_SECONDS);
    spawnPopup('ROPE EXPIRED · AUTO-ACTION', 'amber');
    if (activeGame === 'draw_poker') {
      if (drawPhase === 'mulligan_draw') {
        executeFiveCardMulliganDraw(false);
      } else {
        advanceFiveCardBetting(0);
      }
    } else if (activeGame === 'poker') {
      advancePokerStreet(0);
    } else if (activeGame === 'blackjack') {
      standBlackjack();
    } else if (activeGame === 'uno') {
      const firstPlayable = unoPlayerHand.find((c) => canPlayUnoCard(c));
      if (firstPlayable) {
        playUnoCard(firstPlayable, unoPreferredWildColor);
      } else {
        drawUnoCardForPlayer();
      }
    }
  }, [ropeSecondsLeft, isCompetitiveMode, ropeEnabled, isPlayerDecisionActive]);

  // ==================== PILE BROWSER PAYLOAD COMPUTATION ====================
  const currentBrowsablePiles = useMemo(() => {
    const buildDeckSuitSummary = (deckCards: PlayingCard[]): BrowsablePileEntry[] =>
      SUITS.map((s) => {
        const count = deckCards.filter((c) => c.suit === s).length;
        return {
          id: `suit_${s}`,
          label: `${s} × ${count}`,
          sublabel: `${SUIT_NAMES[s]} Left`,
          accent: s === '♥' || s === '♦' ? 'red' : 'gold',
        };
      });

    if (activeGame === 'solitaire') {
      return [
        {
          pileName: 'Waste Pile',
          subtitle: 'Face-up cards drawn from Stock (top card playable first).',
          items: solWaste.map((c) => ({
            id: c.id,
            label: `${c.rank}${c.suit}`,
            sublabel: SUIT_NAMES[c.suit],
            accent: (c.suit === '♥' || c.suit === '♦' ? 'red' : 'gold') as 'red' | 'gold',
          })),
        },
        {
          pileName: 'Suit Foundations',
          subtitle: 'Cards promoted A → K across all four suits.',
          items: SUITS.flatMap((s) =>
            solFoundations[s].map((c) => ({
              id: c.id,
              label: `${c.rank}${c.suit}`,
              sublabel: `${SUIT_NAMES[s]} Foundation`,
              accent: (s === '♥' || s === '♦' ? 'red' : 'gold') as 'red' | 'gold',
            }))
          ),
        },
        {
          pileName: 'Unseen Stock Suits',
          subtitle: 'Unspoiled suit counts remaining inside the face-down Stock.',
          items: buildDeckSuitSummary(solStock),
        },
      ];
    }

    if (activeGame === 'draw_poker') {
      return [
        {
          pileName: 'Draw Discard Stack',
          subtitle: `Cards tossed during the Hold/Mulligan phase (${drawDiscardPile.length} cards).`,
          items: drawDiscardPile.map((_, idx) => ({
            id: `disc_${idx}`,
            label: `Card #${idx + 1}`,
            sublabel: 'Face-Down Muck',
            accent: 'gold' as const,
          })),
        },
        {
          pileName: 'Remaining Deck Suits',
          subtitle: 'Suit distribution remaining in the undealt 5-Card Draw shoe.',
          items: buildDeckSuitSummary(drawDeck),
        },
      ];
    }

    if (activeGame === 'poker') {
      return [
        {
          pileName: 'Community Board',
          subtitle: 'Shared Texas Hold’em Flop, Turn, and River cards.',
          items: community.map((c) => ({
            id: c.id,
            label: `${c.rank}${c.suit}`,
            sublabel: SUIT_NAMES[c.suit],
            accent: (c.suit === '♥' || c.suit === '♦' ? 'red' : 'gold') as 'red' | 'gold',
          })),
        },
        {
          pileName: 'Remaining Shoe Suits',
          subtitle: 'Unseen suit counts in the Hold’em deck.',
          items: buildDeckSuitSummary(pokerDeck),
        },
      ];
    }

    if (activeGame === 'blackjack') {
      return [
        {
          pileName: 'Remaining Shoe Suits',
          subtitle: `${bjDeck.length} cards remaining in the Blackjack shoe.`,
          items: buildDeckSuitSummary(bjDeck),
        },
      ];
    }

    return [
      {
        pileName: 'UNO Discard History',
        subtitle: 'Chronological public cards played onto the center stack.',
        items: unoDiscardHistory.map((c) => ({
          id: c.id,
          label: `${c.color} ${c.label}`,
          sublabel: c.color === 'W' ? 'Wild Action' : `Suit ${c.color}`,
          accent: (c.color === 'R' ? 'red' : 'gold') as 'red' | 'gold',
        })),
      },
      {
        pileName: 'UNO Draw Stock Colors',
        subtitle: `${unoDeck.length} cards remaining in the UNO Draw Stock.`,
        items: (['R', 'G', 'B', 'Y', 'W'] as const).map((col) => ({
          id: `uno_col_${col}`,
          label: `${col} × ${unoDeck.filter((c) => c.color === col).length}`,
          sublabel: col === 'W' ? 'Wild Cards' : `Suit ${col}`,
          accent: (col === 'R' ? 'red' : 'gold') as 'red' | 'gold',
        })),
      },
    ];
  }, [
    activeGame,
    solWaste,
    solFoundations,
    solStock,
    drawDiscardPile,
    drawDeck,
    community,
    pokerDeck,
    bjDeck,
    unoDiscardHistory,
    unoDeck,
  ]);

  // ==================== 6. EXPANDED 78-CARD TAROT & ASTROLOGY ORACLE (SILENT POSTURE) ====================
  const [tarotMode, setTarotMode] = useState<
    'destiny_3' | 'celtic_5' | 'zodiac_12_houses' | 'astrology_trial'
  >('destiny_3');
  const [sunSign, setSunSign] = useState<string>('Sagittarius');
  const [moonSign, setMoonSign] = useState<string>('Pisces');
  const [risingSign, setRisingSign] = useState<string>('Leo');
  const [activeNatalSlot, setActiveNatalSlot] = useState<'sun' | 'moon' | 'rising'>('sun');
  const [querentFocus, setQuerentFocus] = useState<
    'Cosmic Destiny' | 'Love & Twin Flame' | 'Wealth & Career' | 'Shadow & Karma'
  >('Cosmic Destiny');
  const [tarotSpread, setTarotSpread] = useState<RealTarotCard[]>([]);
  const [inspectedTarotCard, setInspectedTarotCard] = useState<RealTarotCard | null>(null);

  const [trialHouses, setTrialHouses] = useState<
    Array<{
      houseTitle: string;
      targetElement: TarotElement;
      rulingSign: string;
      prophecyPrompt: string;
      playedCard: RealTarotCard | null;
    }>
  >([]);
  const [trialHand, setTrialHand] = useState<RealTarotCard[]>([]);
  const [selectedTrialHouseIdx, setSelectedTrialHouseIdx] = useState<number>(0);
  const [tarotBanner, setTarotBanner] = useState<string>(
    'Authentic 78-Card Rider-Waite-Smith Tarot & Natal Astrology Oracle · Configure your Sun, Moon & Rising Triad and reveal your cards!'
  );

  const dealNewTarotReading = useCallback(
    (targetMode = tarotMode, startFaceDown = false) => {
      const fullDeck = createReal78CardTarotDeck();
      const count =
        targetMode === 'zodiac_12_houses' ? 12 : targetMode === 'celtic_5' ? 5 : 3;
      const drawn = fullDeck.slice(0, count).map((c) => ({ ...c, revealed: !startFaceDown }));
      setTarotSpread(drawn);
      setInspectedTarotCard(drawn[0] || null);

      const houseTemplates: Array<{
        houseTitle: string;
        targetElement: TarotElement;
        rulingSign: string;
        prophecyPrompt: string;
      }> = [
        {
          houseTitle: 'I · 1st House of the Ascendant Flame',
          targetElement: 'Fire',
          rulingSign: risingSign,
          prophecyPrompt: 'Channel a Fire (Wands) or Solar/Martian Arcana aligned with your Ascendant.',
        },
        {
          houseTitle: 'IV · 4th House of Lunar Tides & Soul Roots',
          targetElement: 'Water',
          rulingSign: moonSign,
          prophecyPrompt: 'Channel a Water (Cups) or Lunar/Neptunian Arcana aligned with your Natal Moon.',
        },
        {
          houseTitle: 'X · 10th House of Sovereign Destiny & Crown',
          targetElement: 'Earth',
          rulingSign: sunSign,
          prophecyPrompt: 'Channel an Earth (Pentacles) or Air (Swords) Arcana to crown your Solar calling.',
        },
      ];
      setTrialHouses(houseTemplates.map((h) => ({ ...h, playedCard: null })));
      setTrialHand(fullDeck.slice(15, 21).map((c) => ({ ...c, revealed: true, isReversed: false })));
      setSelectedTrialHouseIdx(0);
      setTarotBanner(
        targetMode === 'astrology_trial'
          ? 'Celestial Trial of Fate: Tap a Tarot card below to channel it into the selected Astrological Transit House!'
          : targetMode === 'zodiac_12_houses'
          ? '12-House Astrological Zodiac Wheel illuminated · Tap any House card to inspect its planetary prophecy in the Grimoire.'
          : '78-Card Rider-Waite-Smith Spread illuminated · Tap any card on the altar to inspect its full Kabbalistic & Astrological prophecy.'
      );
    },
    [tarotMode, sunSign, moonSign, risingSign]
  );

  useEffect(() => {
    dealNewTarotReading('destiny_3', false);
  }, []);

  const sunProfile = useMemo(
    () => ZODIAC_SIGNS.find((z) => z.sign === sunSign) || ZODIAC_SIGNS[8],
    [sunSign]
  );
  const moonProfile = useMemo(
    () => ZODIAC_SIGNS.find((z) => z.sign === moonSign) || ZODIAC_SIGNS[11],
    [moonSign]
  );
  const risingProfile = useMemo(
    () => ZODIAC_SIGNS.find((z) => z.sign === risingSign) || ZODIAC_SIGNS[4],
    [risingSign]
  );

  const revealSpreadCard = (idx: number) => {
    const target = tarotSpread[idx];
    if (!target) return;
    if (!target.revealed) {
      const next = tarotSpread.map((c, i) => (i === idx ? { ...c, revealed: true } : c));
      setTarotSpread(next);
      setInspectedTarotCard({ ...target, revealed: true });
      const allRevealed = next.every((c) => c.revealed);
      setTarotBanner(
        allRevealed
          ? `All ${next.length} Tarot cards illuminated! Inspect Elemental Dignities and Natal Triad synthesis below.`
          : `Revealed ${target.name} (${target.isReversed ? 'Reversed' : 'Upright'} · ${target.astrologyRuler})`
      );
    } else {
      setInspectedTarotCard(target);
      setTarotBanner(
        `Inspecting ${target.name} (${target.isReversed ? 'Reversed' : 'Upright'} · ${target.astrologyRuler})`
      );
    }
  };

  const revealAllSpreadCards = () => {
    const next = tarotSpread.map((c) => ({ ...c, revealed: true }));
    setTarotSpread(next);
    if (next.length > 0) setInspectedTarotCard(next[0]);
    setTarotBanner('All cards illuminated on the Oracle Altar! Review your Natal Triad & Elemental Dignities below.');
  };

  const elementalDignities = useMemo(() => {
    const revealed = tarotSpread.filter((c) => c.revealed);
    const pairs: ElementalDignityAspect[] = [];
    for (let i = 0; i < revealed.length - 1; i++) {
      pairs.push(evaluateElementalDignity(revealed[i], revealed[i + 1]));
    }
    return pairs;
  }, [tarotSpread]);

  const spreadAstrologySynthesis = useMemo(() => {
    const revealedCards = tarotSpread.filter((c) => c.revealed);
    if (revealedCards.length === 0) {
      return {
        resonanceScore: 0,
        majorCount: 0,
        sunMatches: 0,
        moonMatches: 0,
        risingMatches: 0,
        dignityBonus: 0,
        dominantElement: sunProfile.element,
        prophecySummary:
          'Reveal the cards on the altar to synthesize your Sun, Moon, Rising, and Elemental Dignities.',
      };
    }

    let score = 0;
    let majorCount = 0;
    let sunMatches = 0;
    let moonMatches = 0;
    let risingMatches = 0;
    const elemCounts: Record<TarotElement, number> = { Fire: 0, Water: 0, Air: 0, Earth: 0 };

    for (const c of revealedCards) {
      elemCounts[c.element]++;
      score += c.celestialPower;
      if (c.arcana === 'Major') {
        majorCount++;
        score += 28;
      }
      if (c.zodiacAffinity.includes(sunSign) || c.element === sunProfile.element) {
        sunMatches++;
        score += 24;
      }
      if (c.zodiacAffinity.includes(moonSign) || c.element === moonProfile.element) {
        moonMatches++;
        score += 22;
      }
      if (c.zodiacAffinity.includes(risingSign) || c.element === risingProfile.element) {
        risingMatches++;
        score += 20;
      }
    }

    const dignityBonus = elementalDignities.reduce((acc, d) => acc + d.bonusScore, 0);
    score += dignityBonus;

    const dominantElement = (Object.keys(elemCounts) as TarotElement[]).sort(
      (a, b) => elemCounts[b] - elemCounts[a]
    )[0];

    const leadCard = revealedCards[revealedCards.length - 1];
    const totalNatalAlignments = sunMatches + moonMatches + risingMatches;
    const prophecySummary = `For Natal Triad ☉ ${sunProfile.glyph} ${sunSign} (${sunProfile.ruler}) · ☽ ${moonProfile.glyph} ${moonSign} (${moonProfile.ruler}) · ↑ ${risingProfile.glyph} ${risingSign} Ascendant seeking clarity on ${querentFocus}: ${majorCount} Major Arcana archetype(s) and ${totalNatalAlignments} Natal Triad aspect(s) converge under dominant ${dominantElement} energy (+${dignityBonus} Elemental Dignity resonance). ${leadCard.name} (${leadCard.isReversed ? 'Reversed' : 'Upright'}) seals your prophecy: "${
      leadCard.isReversed ? leadCard.reversedMeaning : leadCard.uprightMeaning
    }"`;

    return {
      resonanceScore: score,
      majorCount,
      sunMatches,
      moonMatches,
      risingMatches,
      dignityBonus,
      dominantElement,
      prophecySummary,
    };
  }, [
    tarotSpread,
    sunSign,
    moonSign,
    risingSign,
    querentFocus,
    sunProfile,
    moonProfile,
    risingProfile,
    elementalDignities,
  ]);

  const completeOracleReadingAndClaim = () => {
    const allOpen = tarotSpread.every((c) => c.revealed);
    if (!allOpen) {
      revealAllSpreadCards();
    }
    const chipReward = Math.max(
      180,
      Math.min(550, Math.round(spreadAstrologySynthesis.resonanceScore * 0.75))
    );
    setTarotBanner(
      `Oracle Reading Sealed! Cosmic Resonance ${spreadAstrologySynthesis.resonanceScore} awarded +${chipReward} Chips & +1 Daily Win Point!`
    );

    const spreadName =
      tarotMode === 'zodiac_12_houses'
        ? '12-House Astrological Zodiac Spread'
        : tarotMode === 'celtic_5'
        ? '5-Card Celtic Cross'
        : '3-Card Destiny Spread';

    triggerGameComplete({
      gameId: 'tarot',
      gameTitle: '78-Card Tarot & Astrology Oracle',
      gameTypeLedger: 'TAROT_ORACLE',
      outcome: 'win',
      headline: `${spreadName} Complete!`,
      subheadline: spreadAstrologySynthesis.prophecySummary,
      chipsDelta: chipReward,
      stats: [
        { label: 'Natal Triad', value: `☉${sunProfile.glyph} ☽${moonProfile.glyph} ↑${risingProfile.glyph}` },
        { label: 'Cosmic Resonance', value: `${spreadAstrologySynthesis.resonanceScore} Pts` },
        { label: 'Dominant Element', value: spreadAstrologySynthesis.dominantElement },
        { label: 'Elemental Dignities', value: `+${spreadAstrologySynthesis.dignityBonus} Pts` },
        { label: 'Major Arcana Drawn', value: `${spreadAstrologySynthesis.majorCount} Cards` },
        { label: 'Oracle Focus', value: querentFocus },
      ],
      statePayload: {
        sunSign,
        moonSign,
        risingSign,
        focus: querentFocus,
        resonanceScore: spreadAstrologySynthesis.resonanceScore,
      },
      onPlayAgain: () => dealNewTarotReading(tarotMode, false),
    });
  };

  const assignCardToTrialHouse = (card: RealTarotCard) => {
    const house = trialHouses[selectedTrialHouseIdx];
    if (!house || house.playedCard) return;

    const nextHouses = trialHouses.map((h, i) =>
      i === selectedTrialHouseIdx ? { ...h, playedCard: card } : h
    );
    const nextHand = trialHand.filter((c) => c.id !== card.id);
    setTrialHouses(nextHouses);
    setTrialHand(nextHand);
    setInspectedTarotCard(card);

    const nextEmptyIdx = nextHouses.findIndex((h) => h.playedCard === null);
    if (nextEmptyIdx !== -1) {
      setSelectedTrialHouseIdx(nextEmptyIdx);
      setTarotBanner(
        `Channeled ${card.name} (${card.element}) into ${house.houseTitle} · Now select a card for ${nextHouses[nextEmptyIdx].houseTitle}`
      );
    } else {
      let totalHarmony = 0;
      for (const h of nextHouses) {
        const pc = h.playedCard!;
        let pts = pc.celestialPower;
        if (pc.element === h.targetElement) pts += 65;
        if (
          pc.zodiacAffinity.includes(h.rulingSign) ||
          pc.zodiacAffinity.includes(sunSign) ||
          pc.zodiacAffinity.includes(moonSign) ||
          pc.zodiacAffinity.includes(risingSign)
        ) {
          pts += 50;
        }
        if (pc.arcana === 'Major') pts += 35;
        totalHarmony += pts;
      }
      const delta = totalHarmony >= 260 ? 300 : 150;
      setTarotBanner(
        `Celestial Trial Complete! Planetary Harmony Score: ${totalHarmony} pts (+${delta} Chips & +1 Daily Win Point)!`
      );
      triggerGameComplete({
        gameId: 'tarot',
        gameTitle: 'Celestial Trial of Fate (Tarot)',
        gameTypeLedger: 'TAROT_ASTROLOGY_TRIAL',
        outcome: 'win',
        headline: `Celestial Trial Fulfilled (${totalHarmony} Pts)!`,
        subheadline: `Channeled ${nextHouses.map((h) => h.playedCard?.name).join(', ')} across your Ascendant, Lunar, and Solar Transit Houses.`,
        chipsDelta: delta,
        stats: [
          { label: 'Planetary Harmony', value: `${totalHarmony} Pts` },
          { label: 'Natal Triad', value: `☉${sunSign} ☽${moonSign} ↑${risingSign}` },
          { label: 'Houses Aligned', value: '3 / 3 Houses' },
        ],
        statePayload: { totalHarmony, sunSign, moonSign, risingSign },
        onPlayAgain: () => dealNewTarotReading('astrology_trial', false),
      });
    }
  };

  // Distinct Esoteric Gold Vector Art per Major Arcana & Minor Suit (Only SVG rotates on Reversed)
  const renderArcanaArtworkSvg = (card: RealTarotCard) => {
    const rotationClass = card.isReversed ? 'rotate-180' : '';

    if (card.arcana === 'Major') {
      const n = card.number;
      return (
        <svg
          viewBox="0 0 100 100"
          className={`w-24 h-24 sm:w-28 sm:h-28 text-yellow-400 transition-transform ${rotationClass}`}
        >
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
          <circle cx="50" cy="50" r="39" fill="none" stroke="currentColor" strokeWidth="0.9" strokeDasharray="2 2" opacity="0.45" />
          <circle cx="14" cy="14" r="2" fill="currentColor" opacity="0.7" />
          <circle cx="86" cy="14" r="2" fill="currentColor" opacity="0.7" />
          <circle cx="14" cy="86" r="2" fill="currentColor" opacity="0.7" />
          <circle cx="86" cy="86" r="2" fill="currentColor" opacity="0.7" />
          {n === 0 ? (
            <>
              <circle cx="72" cy="26" r="10" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="1.8" />
              <path d="M15 78 L48 52 L65 78" fill="none" stroke="currentColor" strokeWidth="2.4" />
              <polygon points="48,20 52,33 65,33 54,41 58,54 48,46 38,54 42,41 31,33 44,33" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.7" />
            </>
          ) : n === 1 || n === 8 ? (
            <>
              <path d="M24 50 C24 32, 46 32, 50 50 C54 68, 76 68, 76 50 C76 32, 54 32, 50 50 C46 68, 24 68, 24 50 Z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="2.4" />
              <circle cx="50" cy="23" r="6.5" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="1.8" />
              <line x1="50" y1="62" x2="50" y2="85" stroke="currentColor" strokeWidth="2.2" />
            </>
          ) : n === 2 || n === 18 ? (
            <>
              <rect x="20" y="22" width="10" height="56" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.8" />
              <rect x="70" y="22" width="10" height="56" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.8" />
              <path d="M56 28 A18 18 0 1 0 56 72 A13 18 0 1 1 56 28 Z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
            </>
          ) : n === 3 || n === 4 || n === 5 ? (
            <>
              <polygon points="26,38 36,22 50,34 64,22 74,38" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="2" />
              <circle cx="50" cy="56" r="16" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2" />
              <line x1="50" y1="40" x2="50" y2="82" stroke="currentColor" strokeWidth="2" />
              <line x1="36" y1="56" x2="64" y2="56" stroke="currentColor" strokeWidth="2" />
            </>
          ) : n === 6 || n === 7 || n === 14 ? (
            <>
              <polygon points="50,18 76,68 24,68" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="2" />
              <polygon points="50,82 76,32 24,32" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="2" />
              <circle cx="50" cy="50" r="9" fill="currentColor" fillOpacity="0.4" />
            </>
          ) : n === 10 ? (
            <>
              <circle cx="50" cy="50" r="30" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2.2" />
              <circle cx="50" cy="50" r="10" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.8" />
              <line x1="50" y1="16" x2="50" y2="84" stroke="currentColor" strokeWidth="1.8" />
              <line x1="16" y1="50" x2="84" y2="50" stroke="currentColor" strokeWidth="1.8" />
              <line x1="26" y1="26" x2="74" y2="74" stroke="currentColor" strokeWidth="1.6" />
              <line x1="74" y1="26" x2="26" y2="74" stroke="currentColor" strokeWidth="1.6" />
            </>
          ) : n === 11 ? (
            <>
              <line x1="50" y1="16" x2="50" y2="84" stroke="currentColor" strokeWidth="2.4" />
              <line x1="22" y1="38" x2="78" y2="38" stroke="currentColor" strokeWidth="2" />
              <path d="M22 38 L15 56 H29 Z M78 38 L71 56 H85 Z" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="1.6" />
            </>
          ) : n === 17 || n === 19 ? (
            <>
              <polygon points="50,12 58,38 86,38 63,54 72,82 50,65 28,82 37,54 14,38 42,38" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="2" />
              <circle cx="50" cy="50" r="12" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.8" />
            </>
          ) : n === 21 ? (
            <>
              <ellipse cx="50" cy="50" rx="22" ry="32" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="2.4" />
              <circle cx="50" cy="50" r="9" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="22" cy="22" r="3.5" fill="currentColor" />
              <circle cx="78" cy="22" r="3.5" fill="currentColor" />
              <circle cx="22" cy="78" r="3.5" fill="currentColor" />
              <circle cx="78" cy="78" r="3.5" fill="currentColor" />
            </>
          ) : (
            <>
              <polygon points="50,14 61,39 88,39 66,55 75,82 50,66 25,82 34,55 12,39 39,39" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2" />
              <circle cx="50" cy="50" r="14" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="1.8" />
            </>
          )}
        </svg>
      );
    }

    return (
      <svg
        viewBox="0 0 100 100"
        className={`w-24 h-24 sm:w-28 sm:h-28 text-yellow-400 transition-transform ${rotationClass}`}
      >
        <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.5" />
        <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="0.9" strokeDasharray="2 2" opacity="0.4" />
        {card.suit === 'Wands' ? (
          <>
            <path d="M50 14 L50 86 M34 30 L50 16 L66 30 M32 48 L50 36 M68 56 L50 44" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" fill="none" />
            <circle cx="50" cy="14" r="4" fill="currentColor" />
          </>
        ) : card.suit === 'Cups' ? (
          <path d="M26 24 H74 C74 52 58 63 50 63 C42 63 26 52 26 24 Z M50 63 V82 M32 82 H68" stroke="currentColor" strokeWidth="2.6" fill="currentColor" fillOpacity="0.18" />
        ) : card.suit === 'Swords' ? (
          <path d="M50 12 L57 68 L43 68 Z M28 68 H72 M50 68 V88" stroke="currentColor" strokeWidth="2.6" fill="currentColor" fillOpacity="0.18" />
        ) : (
          <>
            <circle cx="50" cy="50" r="28" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="2.2" />
            <polygon points="50,24 57,43 76,43 61,54 67,73 50,61 33,73 39,54 24,43 43,43" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.8" />
          </>
        )}
      </svg>
    );
  };

  // Enlarged 3D-Flipping Tarot Card Renderer (All Text Upright, Silent)
  const renderTarotCardVisual = (
    card: RealTarotCard,
    slotLabel?: string,
    onClick?: () => void,
    isSelected?: boolean,
    compact = false,
    dealIdx = 0
  ) => {
    const elemGlyph: Record<TarotElement, string> = {
      Fire: '🜂 Fire',
      Water: '🜄 Water',
      Air: '🜁 Air',
      Earth: '🜃 Earth',
    };

    const sizeClass = compact
      ? 'w-44 h-72 sm:w-48 sm:h-76'
      : 'w-52 h-84 sm:w-56 sm:h-88';
    const rulerShort = card.astrologyRuler.split('·')[0].trim();

    return (
      <motion.div
        key={card.id}
        initial={{ opacity: 0, y: 26, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24, delay: Math.min(0.45, dealIdx * 0.05) }}
        className={`${sizeClass} [perspective:1200px] shrink-0`}
      >
        <motion.button
          type="button"
          onClick={onClick}
          whileHover={{ y: -6, scale: 1.02 }}
          animate={{ rotateY: card.revealed ? 0 : 180 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24 }}
          className="relative w-full h-full [transform-style:preserve-3d] cursor-pointer text-left touch-manipulation rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
        >
          {/* REVEALED FRONT (0deg) */}
          <div
            className={`absolute inset-0 w-full h-full rounded-2xl bg-[#0B0A07] p-3.5 flex flex-col justify-between [backface-visibility:hidden] shadow-xl ${
              isSelected
                ? 'border-2 border-yellow-300 ring-2 ring-yellow-400/70 shadow-[0_0_30px_rgba(250,204,21,0.4)]'
                : card.arcana === 'Major'
                ? 'border-2 border-yellow-400/85'
                : 'border border-yellow-500/45'
            }`}
          >
            <div className="w-full flex items-center justify-between text-xs font-mono text-yellow-300 border-b border-yellow-500/25 pb-1.5">
              <span className="font-bold text-yellow-200">{card.romanOrRank}</span>
              <span className="font-semibold">{elemGlyph[card.element]}</span>
            </div>

            <div className="my-2 flex-1 w-full rounded-xl bg-[#13110A] border border-yellow-500/35 flex flex-col items-center justify-between py-2 px-2">
              <div className="text-xs font-mono font-bold text-yellow-200 text-center line-clamp-1">
                {rulerShort}
              </div>
              <div className="flex items-center justify-center my-auto">
                {renderArcanaArtworkSvg(card)}
              </div>
              <div className="text-[11px] font-mono text-yellow-300 text-center line-clamp-1">
                {card.keywords.slice(0, 2).join(' · ')}
              </div>
            </div>

            <div className="space-y-0.5 w-full pt-0.5">
              {slotLabel && (
                <div className="text-[11px] font-mono uppercase tracking-wider text-yellow-400 font-semibold truncate">
                  {slotLabel}
                </div>
              )}
              <div className="text-sm sm:text-base font-bold font-display text-yellow-50 leading-snug truncate">
                {card.name}
              </div>
              <div className="flex items-center justify-between text-xs font-mono pt-0.5">
                <span className={card.isReversed ? 'text-amber-400 font-bold' : 'text-yellow-300 font-bold'}>
                  {card.isReversed ? '↓ Reversed' : '↑ Upright'}
                </span>
                <span className="text-yellow-100/80 font-semibold">{card.arcana}</span>
              </div>
            </div>
          </div>

          {/* MYSTERY CARD BACK (180deg) */}
          <div className="absolute inset-0 w-full h-full rounded-2xl bg-[#080806] border-2 border-yellow-500/60 p-3.5 flex flex-col items-center justify-between shadow-xl [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <span className="text-xs font-mono uppercase tracking-wider text-yellow-300 font-bold text-center line-clamp-1">
              {slotLabel || 'ARCANA MYSTERY'}
            </span>
            <div className="w-full flex-1 my-2 rounded-xl border border-yellow-500/35 bg-[#121009] flex flex-col items-center justify-center p-3">
              <svg viewBox="0 0 100 140" className="w-24 h-32 text-yellow-400/85">
                <circle cx="50" cy="70" r="36" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 3" />
                <polygon points="50,28 63,56 92,56 68,74 77,104 50,86 23,104 32,74 8,56 37,56" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="50" cy="70" r="10" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <span className="text-xs font-mono font-bold text-yellow-200 mt-1.5">Tap to Flip &amp; Reveal</span>
            </div>
            <span className="text-[11px] font-mono text-yellow-400/80 font-semibold">RIDER · WAITE · ORACLE</span>
          </div>
        </motion.button>
      </motion.div>
    );
  };

  // Phase Banner Summary per Active Card Table
  const activePhaseLabel =
    activeGame === 'solitaire'
      ? `SOLITAIRE · ${totalFoundationCards}/52`
      : activeGame === 'draw_poker'
      ? drawPhase === 'bet_1'
        ? 'ANTE & BET 1'
        : drawPhase === 'mulligan_draw'
        ? 'HOLD & REDRAW'
        : drawPhase === 'bet_2'
        ? 'FINAL BET'
        : 'SHOWDOWN'
      : activeGame === 'poker'
      ? `HOLD’EM · ${street.toUpperCase()}`
      : activeGame === 'blackjack'
      ? bjPhase === 'playing'
        ? 'PLAYER ACTION'
        : 'HAND SETTLED'
      : activeGame === 'uno'
      ? unoTurn === 'player'
        ? 'YOUR TURN'
        : 'PEER TURN'
      : 'ORACLE ALTAR';

  const activeStatusMessage =
    activeGame === 'solitaire'
      ? solBanner
      : activeGame === 'draw_poker'
      ? drawStatus
      : activeGame === 'poker'
      ? pokerStatus
      : activeGame === 'blackjack'
      ? bjBanner
      : activeGame === 'uno'
      ? unoStatus
      : tarotBanner;

  return (
    <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-4 sm:py-5 space-y-4">
      {/* Dynamic Bezier Targeting Tether & Floating Chain/Score Feedback */}
      <BezierTargetingOverlay vector={dragVector} />
      <TableFeedbackLayer popups={popups} chainSteps={chainSteps} />

      {/* Mobile-First Sticky Card Mode Selector & Bankroll Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-yellow-500/25">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-yellow-400 font-display">
              Obsidian &amp; Gold Tactile Card Arena
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-200 mt-0.5 font-mono tabular-nums">
              <span className="text-yellow-400 font-bold">
                Points: {points} ({dailyPointsEarned}/50 Today)
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-yellow-100 font-semibold">
                Bankroll: {bankroll.toLocaleString()} Chips
              </span>
              {remoteRoomState?.lastActorHandle ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Peer: {String(remoteRoomState.lastActorHandle)}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Horizontally Swipeable Mobile-Friendly 6-Tab Bar */}
        <div className="flex items-center gap-1.5 p-1.5 bg-[#100F0A] border border-yellow-500/35 rounded-2xl overflow-x-auto no-scrollbar">
          {CARD_GAME_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (tab.id !== 'tarot') {
                  nativeBridge.playSfx('move');
                }
                setActiveGame(tab.id);
              }}
              className={`min-h-[42px] px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer touch-manipulation ${
                activeGame === tab.id
                  ? 'bg-yellow-400 text-black shadow-sm'
                  : 'text-neutral-200 hover:text-yellow-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Collapsible P2P Escrow + Interactive Guide + Phase/Rope HUD (Hidden on Tarot) */}
      {activeGame !== 'tarot' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            <MinimizableEscrowBar
              points={points}
              dailyPointsEarned={dailyPointsEarned}
              isP2PConnected={isP2PConnected}
              activeP2PPointBet={activeP2PPointBet}
              onPlaceP2PPointBet={onPlaceP2PPointBet}
              arenaLabel="Card Table P2P Point Escrow"
            />
            <MinimizableTutorial gameId={activeGame} defaultMinimized={true} />
          </div>

          <PhaseAndRopeBar
            phaseLabel={activePhaseLabel}
            statusMessage={activeStatusMessage}
            isCompetitiveMode={isCompetitiveMode}
            ropeEnabled={ropeEnabled}
            onToggleRope={() => setRopeEnabled((v) => !v)}
            ropeSecondsLeft={ropeSecondsLeft}
            ropeMaxSeconds={ROPE_DURATION_SECONDS}
            actionLogCount={actionLog.length}
            onOpenHistory={() => setIsHistoryOpen(true)}
            onOpenPileBrowser={() => setIsPileBrowserOpen(true)}
          />
        </div>
      )}

      {/* Directional Micro-Shake Table Playfield Container */}
      <motion.div
        key={shakeTick}
        animate={shakeTick > 0 ? { x: [0, -7, 7, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* ==================== 1. KLONDIKE SOLITAIRE ==================== */}
        {activeGame === 'solitaire' && (
          <div className="rounded-2xl bg-[#0B0A06] border border-yellow-500/40 p-4 sm:p-6 space-y-5 shadow-2xl">
            {/* Top Stock, Waste & 4 Suit Foundations Row */}
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-yellow-500/20">
              <div className="flex items-start gap-3 sm:gap-5">
                <TactileDeckStock
                  count={solStock.length}
                  label="STOCK"
                  sublabel={solStock.length > 0 ? 'Tap Draw' : 'Recycle'}
                  isShuffling={isShuffling}
                  onDraw={drawSolStock}
                  onInspectPile={() => setIsPileBrowserOpen(true)}
                  size="sm"
                />

                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-xs font-mono text-yellow-300 font-bold tabular-nums">
                    WASTE ({solWaste.length})
                  </span>
                  {solWaste.length > 0 ? (
                    <TactilePlayingCard
                      id={solWaste[0].id}
                      rank={solWaste[0].rank}
                      suit={solWaste[0].suit}
                      faceUp={true}
                      size="sm"
                      isSelected={solSelected?.source === 'waste'}
                      isComboHighlight={canMoveToFoundation(solWaste[0])}
                      isPlayable={true}
                      statusBadge={canMoveToFoundation(solWaste[0]) ? 'PROMOTE' : undefined}
                      onClick={handleWasteClick}
                      onDoubleClick={() => handleFoundationClick(solWaste[0].suit)}
                      onDragVectorChange={setDragVector}
                      onDropToSlot={(slotId) =>
                        handleSolitaireDropToSlot(slotId, { type: 'waste' })
                      }
                      inspectPayload={buildPlayingCardInspector(solWaste[0], 'solitaire')}
                      onInspect={(payload, anchor) => setInspectedCard({ payload, anchor })}
                    />
                  ) : (
                    <div className="w-[70px] h-[102px] sm:w-[90px] sm:h-[130px] rounded-2xl border-2 border-dashed border-yellow-500/30 flex items-center justify-center text-xs font-mono text-neutral-500">
                      Empty
                    </div>
                  )}
                </div>
              </div>

              {/* 4 Magnetic Suit Foundation Drop Slots */}
              <div className="flex items-start gap-2 sm:gap-3 overflow-x-auto no-scrollbar py-0.5">
                {SUITS.map((suit) => {
                  const pile = solFoundations[suit];
                  const top = pile[pile.length - 1];
                  const isHoveredTarget = dragVector?.hoveredSlotId === `foundation-${suit}`;
                  return (
                    <div
                      key={suit}
                      data-drop-slot={`foundation-${suit}`}
                      className="flex flex-col items-center gap-1.5 shrink-0"
                    >
                      <span className="text-xs font-mono text-yellow-300 font-bold tabular-nums">
                        {suit} ({pile.length}/13)
                      </span>
                      {top ? (
                        <TactilePlayingCard
                          id={top.id}
                          rank={top.rank}
                          suit={top.suit}
                          faceUp={true}
                          size="sm"
                          isComboHighlight={isHoveredTarget}
                          onClick={() => handleFoundationClick(suit)}
                          inspectPayload={buildPlayingCardInspector(top, 'solitaire')}
                          onInspect={(payload, anchor) => setInspectedCard({ payload, anchor })}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleFoundationClick(suit)}
                          className={`w-[70px] h-[102px] sm:w-[90px] sm:h-[130px] rounded-2xl bg-[#12110B] hover:bg-[#1D1A0E] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all touch-manipulation ${
                            isHoveredTarget
                              ? 'border-yellow-300 ring-2 ring-yellow-400 bg-yellow-400/15 text-yellow-200 scale-105'
                              : 'border-yellow-500/45 text-yellow-400/80 hover:text-yellow-300'
                          }`}
                        >
                          <span className="text-2xl sm:text-3xl">{suit}</span>
                          <span className="text-[10px] font-mono mt-1 font-bold">ACE → K</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 7-Column Tableau Playfield (Mobile Swipe-Safe + Zero Inline Styles) */}
            <div className="overflow-x-auto no-scrollbar pb-2">
              <div className="grid grid-cols-7 gap-2 sm:gap-3.5 min-w-[540px] min-h-[320px] pt-1">
                {solColumns.map((col, cIdx) => {
                  const isHoveredCol = dragVector?.hoveredSlotId === `tableau-${cIdx}`;
                  return (
                    <div
                      key={cIdx}
                      data-drop-slot={`tableau-${cIdx}`}
                      className={`flex flex-col items-center rounded-2xl p-1 transition-colors ${
                        isHoveredCol ? 'bg-yellow-400/10 ring-1 ring-yellow-400/60' : ''
                      }`}
                    >
                      <div className="text-[11px] font-mono text-yellow-400/85 mb-1.5 font-bold">
                        COL {cIdx + 1}
                      </div>
                      {col.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => handleTableauClick(cIdx, 0)}
                          className="w-[70px] h-[102px] sm:w-[90px] sm:h-[130px] rounded-2xl border-2 border-dashed border-yellow-500/30 hover:border-yellow-400 flex items-center justify-center text-xs font-mono text-yellow-500/70 cursor-pointer touch-manipulation"
                        >
                          King (K)
                        </button>
                      ) : (
                        <div className="flex flex-col items-center">
                          {col.map((card, cardIdx) => {
                            const isSel =
                              solSelected?.source === cIdx && cardIdx >= solSelected.cardIndex;
                            const isTopExposed = cardIdx === col.length - 1 && Boolean(card.faceUp);
                            const foundationReady =
                              isTopExposed && canMoveToFoundation(card);
                            return (
                              <div
                                key={card.id}
                                className={
                                  cardIdx > 0
                                    ? card.faceUp
                                      ? '-mt-[68px] sm:-mt-[88px]'
                                      : '-mt-[82px] sm:-mt-[106px]'
                                    : ''
                                }
                              >
                                <TactilePlayingCard
                                  id={card.id}
                                  rank={card.rank}
                                  suit={card.suit}
                                  faceUp={Boolean(card.faceUp)}
                                  size="sm"
                                  dealIndex={cardIdx}
                                  isSelected={isSel}
                                  isPlayable={Boolean(card.faceUp)}
                                  isComboHighlight={foundationReady}
                                  statusBadge={foundationReady ? 'A→K' : undefined}
                                  onClick={() => handleTableauClick(cIdx, cardIdx)}
                                  onDoubleClick={() => {
                                    if (foundationReady) handleFoundationClick(card.suit);
                                  }}
                                  onDragVectorChange={card.faceUp ? setDragVector : undefined}
                                  onDropToSlot={
                                    card.faceUp
                                      ? (slotId) =>
                                          handleSolitaireDropToSlot(slotId, {
                                            type: 'col',
                                            colIdx: cIdx,
                                            cardIdx,
                                          })
                                      : undefined
                                  }
                                  inspectPayload={
                                    card.faceUp
                                      ? buildPlayingCardInspector(card, 'solitaire')
                                      : undefined
                                  }
                                  onInspect={(payload, anchor) =>
                                    setInspectedCard({ payload, anchor })
                                  }
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Thumb-Zone Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-yellow-500/20">
              <div className="text-xs font-mono text-yellow-200/90 tabular-nums">
                Moves: <strong className="text-yellow-400">{solMoves}</strong> · Foundations:{' '}
                <strong className="text-yellow-400">{totalFoundationCards}/52</strong>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={drawSolStock}
                  className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold text-yellow-100 bg-[#18160D] hover:bg-[#252113] border border-yellow-500/45 rounded-xl cursor-pointer touch-manipulation"
                >
                  Draw Stock ({solStock.length})
                </button>
                <button
                  type="button"
                  onClick={autoPromoteEligibleToFoundations}
                  className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold text-black bg-yellow-400 hover:bg-yellow-300 rounded-xl shadow-md cursor-pointer touch-manipulation"
                >
                  ★ Auto-Promote
                </button>
                <button
                  type="button"
                  disabled={solHistory.length === 0}
                  onClick={undoSolitaireMove}
                  className="min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-semibold text-yellow-200 bg-[#17150C] hover:bg-[#242012] border border-yellow-500/35 rounded-xl disabled:opacity-40 cursor-pointer touch-manipulation"
                >
                  Undo ({solHistory.length})
                </button>
                <button
                  type="button"
                  onClick={completeSolitaireDeckShowcase}
                  className="min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-semibold text-yellow-300 bg-[#17150C] hover:bg-yellow-400 hover:text-black border border-yellow-500/40 rounded-xl cursor-pointer transition-colors touch-manipulation"
                >
                  Solve Showcase
                </button>
                <button
                  type="button"
                  onClick={initSolitaire}
                  className="min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-semibold text-yellow-300 bg-[#17150C] hover:bg-[#242012] border border-yellow-500/35 rounded-xl cursor-pointer touch-manipulation"
                >
                  New Deal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 2. 5-CARD DRAW POKER (WITH HOLD / MULLIGAN REDRAW) ==================== */}
        {activeGame === 'draw_poker' && (
          <div className="rounded-2xl bg-[#0B0A06] border border-yellow-500/40 p-4 sm:p-6 shadow-2xl space-y-5">
            <OpponentArcHud
              opponentName="Viktor_Node"
              cardCount={drawOpponentHand.length}
              telemetryStatus={opponentDrawSummary}
              inspectedSlotIndex={opponentInspectIdx}
              activePlayerEmote={playerEmote}
              activeOpponentEmote={opponentEmote}
              onSendEmote={handleSendEmote}
              revealedCardsNode={
                drawPhase === 'showdown' ? (
                  <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
                    {drawOpponentHand.map((c, idx) => (
                      <TactilePlayingCard
                        key={c.id}
                        id={c.id}
                        rank={c.rank}
                        suit={c.suit}
                        faceUp={true}
                        size="sm"
                        dealIndex={idx}
                        inspectPayload={buildPlayingCardInspector(c, 'poker')}
                        onInspect={(payload, anchor) => setInspectedCard({ payload, anchor })}
                      />
                    ))}
                  </div>
                ) : undefined
              }
            />

            {/* Center Pot & Deck / Discard Stack */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#121008] border border-yellow-500/30 flex flex-wrap items-center justify-around gap-6">
              <TactileDeckStock
                count={drawDeck.length}
                label="DRAW SHOE"
                sublabel={`${drawDiscardPile.length} Mucked`}
                isShuffling={isShuffling}
                onInspectPile={() => setIsPileBrowserOpen(true)}
                size="sm"
              />

              <div className="text-center space-y-1.5">
                <div className="text-xs font-mono text-yellow-300 font-bold tracking-wider">
                  5-CARD DRAW ESCROW POT
                </div>
                <div className="text-3xl sm:text-4xl font-display font-bold text-yellow-400 tabular-nums">
                  {drawPot} Chips
                </div>
                <div className="text-xs sm:text-sm font-mono text-yellow-100">
                  Current Hand Rank:{' '}
                  <strong className="text-yellow-300">
                    {evaluateHoldemHand(drawPlayerHand).label}
                  </strong>
                </div>
              </div>
            </div>

            {/* Interactive Mulligan / Hold Redraw Banner during Draw Phase */}
            {drawPhase === 'mulligan_draw' && (
              <MulliganBannerControl
                title="5-Card Draw Hold & Redraw Stage"
                subtitle="Tap any card in your hand below to toggle its gold HOLD lock. Unheld cards are tossed and replaced!"
                confirmLabel="Redraw Unheld"
                keepAllLabel="Stand Pat (Keep All 5)"
                selectedCount={drawPlayerHand.length - drawHeldIds.length}
                onConfirm={() => executeFiveCardMulliganDraw(false)}
                onKeepAll={() => executeFiveCardMulliganDraw(true)}
              />
            )}

            {/* Player 5-Card Fanned Hand */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-yellow-300 px-1">
                <span>
                  {drawPhase === 'mulligan_draw'
                    ? 'TAP CARDS TO LOCK [HOLD] BEFORE REDRAWING'
                    : 'YOUR 5-CARD POKER HAND'}
                </span>
                <span className="font-bold text-yellow-400">
                  Held: {drawHeldIds.length} / 5
                </span>
              </div>

              <FannedCardHand
                count={drawPlayerHand.length}
                renderCard={(idx, fanAngle, arcOffsetY) => {
                  const card = drawPlayerHand[idx];
                  const isHeld = drawHeldIds.includes(card.id);
                  return (
                    <TactilePlayingCard
                      key={card.id}
                      id={card.id}
                      rank={card.rank}
                      suit={card.suit}
                      faceUp={true}
                      size="lg"
                      dealIndex={idx}
                      fanAngle={fanAngle}
                      arcOffsetY={arcOffsetY}
                      isHeld={isHeld}
                      isPlayable={drawPhase === 'mulligan_draw'}
                      statusBadge={
                        drawPhase === 'mulligan_draw' && !isHeld ? 'DISCARD' : undefined
                      }
                      onClick={() => toggleDrawHoldCard(card.id)}
                      inspectPayload={buildPlayingCardInspector(card, 'poker')}
                      onInspect={(payload, anchor) => setInspectedCard({ payload, anchor })}
                    />
                  );
                }}
              />
            </div>

            {/* Thumb-Zone Betting Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-yellow-500/20">
              <div className="text-xs sm:text-sm font-mono text-yellow-100">
                Your Best 5-Card Hand:{' '}
                <strong className="text-yellow-400">
                  {evaluateHoldemHand(drawPlayerHand).label}
                </strong>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {drawPhase === 'bet_1' || drawPhase === 'bet_2' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => advanceFiveCardBetting(0)}
                      className="min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-bold text-yellow-100 bg-[#17160E] hover:bg-[#242114] border border-yellow-500/45 rounded-xl cursor-pointer touch-manipulation"
                    >
                      {drawPhase === 'bet_2' ? 'Check / Showdown' : 'Check / Call'}
                    </button>
                    <button
                      type="button"
                      onClick={() => advanceFiveCardBetting(50)}
                      className="min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-bold text-black bg-yellow-400 hover:bg-yellow-300 rounded-xl cursor-pointer touch-manipulation"
                    >
                      Raise +50
                    </button>
                    <button
                      type="button"
                      onClick={() => advanceFiveCardBetting(100)}
                      className="min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-bold text-black bg-amber-400 hover:bg-amber-300 rounded-xl cursor-pointer touch-manipulation"
                    >
                      Raise +100
                    </button>
                    <button
                      type="button"
                      onClick={foldFiveCardDraw}
                      className="min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-semibold text-rose-200 bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/40 rounded-xl cursor-pointer touch-manipulation"
                    >
                      Fold
                    </button>
                  </>
                ) : drawPhase === 'showdown' ? (
                  <button
                    type="button"
                    onClick={startFiveCardDrawHand}
                    className="min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-bold text-black bg-yellow-400 hover:bg-yellow-300 rounded-xl cursor-pointer touch-manipulation"
                  >
                    Deal Next 5-Card Draw Hand
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* ==================== 3. TEXAS HOLD'EM POKER ==================== */}
        {activeGame === 'poker' && (
          <div className="rounded-2xl bg-[#0B0A06] border border-yellow-500/40 p-4 sm:p-6 shadow-2xl space-y-5">
            <OpponentArcHud
              opponentName="Viktor_Node"
              cardCount={opponentHole.length}
              telemetryStatus={`Street: ${street.toUpperCase()} · Matching Pot Bets`}
              inspectedSlotIndex={opponentInspectIdx !== null ? opponentInspectIdx % 2 : null}
              activePlayerEmote={playerEmote}
              activeOpponentEmote={opponentEmote}
              onSendEmote={handleSendEmote}
              revealedCardsNode={
                street === 'showdown' ? (
                  <div className="flex items-center gap-2">
                    {opponentHole.map((c, idx) => (
                      <TactilePlayingCard
                        key={c.id}
                        id={c.id}
                        rank={c.rank}
                        suit={c.suit}
                        faceUp={true}
                        size="sm"
                        dealIndex={idx}
                        inspectPayload={buildPlayingCardInspector(c, 'poker')}
                        onInspect={(payload, anchor) => setInspectedCard({ payload, anchor })}
                      />
                    ))}
                  </div>
                ) : undefined
              }
            />

            {/* Center Community Board & Pot */}
            <div className="py-5 px-4 rounded-2xl bg-[#121008] border border-yellow-500/30 flex flex-col items-center space-y-4">
              <div className="flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm font-mono text-yellow-300 font-bold tabular-nums">
                <span>
                  POT ESCROW: <strong className="text-yellow-400 text-lg">{pot} CHIPS</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-yellow-100">{pokerStatus}</span>
              </div>

              <div className="flex items-center justify-start sm:justify-center gap-2.5 sm:gap-3.5 w-full overflow-x-auto no-scrollbar py-1 min-h-[140px]">
                {community.length === 0 ? (
                  <div className="mx-auto flex items-center gap-3">
                    <TactileDeckStock
                      count={pokerDeck.length}
                      label="HOLD’EM SHOE"
                      isShuffling={isShuffling}
                      onInspectPile={() => setIsPileBrowserOpen(true)}
                      size="sm"
                    />
                    <span className="text-xs sm:text-sm font-mono text-neutral-300">
                      Pre-Flop Betting — Call or Raise to deal the 3-card Flop
                    </span>
                  </div>
                ) : (
                  community.map((c, idx) => (
                    <TactilePlayingCard
                      key={c.id}
                      id={c.id}
                      rank={c.rank}
                      suit={c.suit}
                      faceUp={true}
                      size="md"
                      dealIndex={idx}
                      isComboHighlight={playerHole.some(
                        (h) => h.rank === c.rank || h.suit === c.suit
                      )}
                      inspectPayload={buildPlayingCardInspector(c, 'poker')}
                      onInspect={(payload, anchor) => setInspectedCard({ payload, anchor })}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Player Hole Cards + Thumb Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
              <div className="flex items-center justify-center sm:justify-start gap-4">
                <FannedCardHand
                  count={playerHole.length}
                  compactMobileScroll={false}
                  renderCard={(idx, fanAngle, arcOffsetY) => {
                    const card = playerHole[idx];
                    return (
                      <TactilePlayingCard
                        key={card.id}
                        id={card.id}
                        rank={card.rank}
                        suit={card.suit}
                        faceUp={true}
                        size="lg"
                        dealIndex={idx}
                        fanAngle={fanAngle}
                        arcOffsetY={arcOffsetY}
                        isPlayable={street !== 'showdown'}
                        inspectPayload={buildPlayingCardInspector(card, 'poker')}
                        onInspect={(payload, anchor) => setInspectedCard({ payload, anchor })}
                      />
                    );
                  }}
                />
                <div className="space-y-1">
                  <div className="text-xs font-mono text-yellow-400 font-bold">YOUR BEST HAND</div>
                  <div className="text-base sm:text-lg font-display font-bold text-yellow-50">
                    {evaluateHoldemHand([...playerHole, ...community]).label}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {street !== 'showdown' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => advancePokerStreet(0)}
                      className="min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-bold text-yellow-100 bg-[#17160E] hover:bg-[#242114] border border-yellow-500/45 rounded-xl cursor-pointer touch-manipulation"
                    >
                      Check / Call
                    </button>
                    <button
                      type="button"
                      onClick={() => advancePokerStreet(50)}
                      className="min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-bold text-black bg-yellow-400 hover:bg-yellow-300 rounded-xl cursor-pointer touch-manipulation"
                    >
                      Raise +50
                    </button>
                    <button
                      type="button"
                      onClick={() => advancePokerStreet(100)}
                      className="min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-bold text-black bg-amber-400 hover:bg-amber-300 rounded-xl cursor-pointer touch-manipulation"
                    >
                      Raise +100
                    </button>
                    <button
                      type="button"
                      onClick={foldPokerHand}
                      className="min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-semibold text-rose-200 bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/40 rounded-xl cursor-pointer touch-manipulation"
                    >
                      Fold
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={startPokerHand}
                    className="min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-bold text-black bg-yellow-400 hover:bg-yellow-300 rounded-xl cursor-pointer touch-manipulation"
                  >
                    Deal Next Hold’em Hand
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== 4. CASINO BLACKJACK (21) ==================== */}
        {activeGame === 'blackjack' && (
          <div className="rounded-2xl bg-[#0B0A06] border border-yellow-500/40 p-4 sm:p-6 shadow-2xl space-y-5">
            <OpponentArcHud
              opponentName="House_Dealer"
              cardCount={bjDealer.length}
              telemetryStatus={
                bjPhase === 'settled'
                  ? `Dealer Settled at ${blackjackHandTotal(bjDealer).total}`
                  : `Showing ${bjDealer[0]?.rank || ''}${bjDealer[0]?.suit || ''} · Stands on all 17s`
              }
              activePlayerEmote={playerEmote}
              activeOpponentEmote={opponentEmote}
              onSendEmote={handleSendEmote}
              revealedCardsNode={
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {bjDealer.map((c, idx) => {
                    const hideHole = idx === 1 && bjPhase === 'playing';
                    return (
                      <TactilePlayingCard
                        key={c.id}
                        id={c.id}
                        rank={c.rank}
                        suit={c.suit}
                        faceUp={!hideHole}
                        size="md"
                        dealIndex={idx}
                        inspectPayload={!hideHole ? buildPlayingCardInspector(c, 'blackjack') : undefined}
                        onInspect={(payload, anchor) => setInspectedCard({ payload, anchor })}
                      />
                    );
                  })}
                </div>
              }
            />

            {/* Center Shoe + Wager Pot */}
            <div className="p-4 rounded-2xl bg-[#131109] border border-yellow-500/30 flex flex-wrap items-center justify-around gap-4">
              <TactileDeckStock
                count={bjDeck.length}
                label="21 SHOE"
                sublabel="Pays 3:2"
                isShuffling={isShuffling}
                onDraw={bjPhase === 'playing' ? hitBlackjack : undefined}
                onInspectPile={() => setIsPileBrowserOpen(true)}
                size="sm"
              />

              <div className="text-center space-y-1">
                <div className="text-xs font-mono text-yellow-400 font-bold">ACTIVE WAGER</div>
                <div className="text-2xl sm:text-3xl font-display font-bold text-yellow-300 tabular-nums">
                  {bjBet} Chips {bjDoubled ? '(2× DOUBLED)' : ''}
                </div>
                <div className="text-xs sm:text-sm text-yellow-100">{bjBanner}</div>
              </div>
            </div>

            {/* Player Fanned Blackjack Hand + Action Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center justify-center sm:justify-start gap-4">
                <FannedCardHand
                  count={bjPlayer.length}
                  compactMobileScroll={true}
                  renderCard={(idx, fanAngle, arcOffsetY) => {
                    const card = bjPlayer[idx];
                    const pScore = blackjackHandTotal(bjPlayer);
                    return (
                      <TactilePlayingCard
                        key={card.id}
                        id={card.id}
                        rank={card.rank}
                        suit={card.suit}
                        faceUp={true}
                        size="lg"
                        dealIndex={idx}
                        fanAngle={fanAngle}
                        arcOffsetY={arcOffsetY}
                        isPlayable={bjPhase === 'playing'}
                        isComboHighlight={pScore.total === 21}
                        statusBadge={
                          idx === bjPlayer.length - 1
                            ? pScore.total > 21
                              ? 'BUST'
                              : bjDoubled
                              ? '2× DBL'
                              : pScore.total === 21
                              ? '21!'
                              : undefined
                            : undefined
                        }
                        inspectPayload={buildPlayingCardInspector(card, 'blackjack')}
                        onInspect={(payload, anchor) => setInspectedCard({ payload, anchor })}
                      />
                    );
                  }}
                />

                <div className="space-y-0.5 shrink-0">
                  <div className="text-xs font-mono text-yellow-400 font-bold">HAND TOTAL</div>
                  <div className="text-3xl font-mono font-bold text-yellow-300 tabular-nums">
                    {blackjackHandTotal(bjPlayer).total}
                  </div>
                  {blackjackHandTotal(bjPlayer).soft && (
                    <span className="text-[11px] font-mono text-amber-300">Soft Ace Active</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {bjPhase === 'playing' ? (
                  <>
                    <button
                      type="button"
                      onClick={hitBlackjack}
                      className="min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-bold text-black bg-yellow-400 hover:bg-yellow-300 rounded-xl cursor-pointer touch-manipulation"
                    >
                      Hit Card
                    </button>
                    <button
                      type="button"
                      onClick={() => standBlackjack()}
                      className="min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-bold text-yellow-100 bg-[#18160E] hover:bg-[#242114] border border-yellow-500/45 rounded-xl cursor-pointer touch-manipulation"
                    >
                      Stand
                    </button>
                    <button
                      type="button"
                      disabled={bjPlayer.length !== 2}
                      onClick={doubleDownBlackjack}
                      className="min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-bold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 rounded-xl cursor-pointer touch-manipulation"
                    >
                      Double Down (2×)
                    </button>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {[50, 100, 250].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => {
                          setBjBet(w);
                          dealBlackjack(w);
                        }}
                        className="min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-mono font-bold text-black bg-yellow-400 hover:bg-yellow-300 rounded-xl cursor-pointer touch-manipulation"
                      >
                        Deal ({w} Chips)
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== 5. UNO BLITZ COMPETITIVE SHEDDING ==================== */}
        {activeGame === 'uno' && (
          <div className="rounded-2xl bg-[#0B0A06] border border-yellow-500/40 p-4 sm:p-6 shadow-2xl space-y-5">
            <OpponentArcHud
              opponentName="Rival_Peer"
              cardCount={unoBotHand.length}
              telemetryStatus={
                unoBotHand.length === 1
                  ? 'UNO ALERT! Rival down to final card!'
                  : `Active Suit: ${unoActiveColor} · ${unoStatus}`
              }
              inspectedSlotIndex={
                opponentInspectIdx !== null ? opponentInspectIdx % Math.max(1, unoBotHand.length) : null
              }
              activePlayerEmote={playerEmote}
              activeOpponentEmote={opponentEmote}
              onSendEmote={handleSendEmote}
            />

            {/* Opening-Hand Mulligan Banner */}
            {unoMulliganMode && !unoMulliganUsed && (
              <MulliganBannerControl
                title="UNO Opening-Hand Mulligan"
                subtitle="Tap unwanted cards in your hand below to mark REDRAW, then swap them once before your first play!"
                confirmLabel="Redraw Marked"
                keepAllLabel="Cancel / Keep Hand"
                selectedCount={unoMulliganIds.length}
                onConfirm={executeUnoOpeningMulligan}
                onKeepAll={() => {
                  setUnoMulliganMode(false);
                  setUnoMulliganIds([]);
                }}
              />
            )}

            {/* Center UNO Stock + Top Discard + Wild Suit Picker */}
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 py-5 px-4 bg-[#131109] rounded-2xl border border-yellow-500/30">
              <TactileDeckStock
                count={unoDeck.length}
                label="UNO STOCK"
                sublabel="Draw +1"
                isShuffling={isShuffling}
                onDraw={drawUnoCardForPlayer}
                onInspectPile={() => setIsPileBrowserOpen(true)}
                size="md"
              />

              <div className="flex flex-col items-center gap-1.5">
                <span className="text-xs font-mono text-yellow-300 font-bold">
                  ACTIVE SUIT: {unoActiveColor}
                </span>
                <TactileUnoCard
                  id={unoTopCard.id}
                  color={unoTopCard.color === 'W' ? unoActiveColor : unoTopCard.color}
                  label={unoTopCard.label}
                  size="md"
                  isPlayable={true}
                  onInspect={(payload, anchor) => setInspectedCard({ payload, anchor })}
                />
              </div>

              {/* Wild Suit Pre-Selector */}
              <div className="space-y-2 text-center">
                <span className="text-xs font-mono text-yellow-300 font-bold block">
                  WILD SUIT TARGET
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { c: 'R', name: 'Red', cls: 'bg-rose-600 text-white' },
                      { c: 'G', name: 'Green', cls: 'bg-emerald-600 text-white' },
                      { c: 'B', name: 'Blue', cls: 'bg-sky-600 text-white' },
                      { c: 'Y', name: 'Gold', cls: 'bg-yellow-400 text-black' },
                    ] as const
                  ).map((suitOpt) => (
                    <button
                      key={suitOpt.c}
                      type="button"
                      onClick={() => setUnoPreferredWildColor(suitOpt.c)}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-transform ${
                        suitOpt.cls
                      } ${
                        unoPreferredWildColor === suitOpt.c
                          ? 'ring-2 ring-white scale-105'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {suitOpt.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Player Fanned UNO Hand */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono text-yellow-400 font-bold">
                  YOUR UNO HAND ({unoPlayerHand.length} CARDS)
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {!unoMulliganUsed && unoTurn === 'player' && (
                    <button
                      type="button"
                      onClick={() => setUnoMulliganMode((v) => !v)}
                      className="min-h-[40px] px-3.5 py-1.5 text-xs font-mono font-bold rounded-xl bg-[#1C190E] hover:bg-yellow-400 hover:text-black text-yellow-200 border border-yellow-400/50 flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Opening Mulligan</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setUnoCalled(true);
                      nativeBridge.playSfx('uno');
                      spawnPopup('UNO DECLARED!', 'gold');
                      setUnoStatus('UNO Declared!');
                    }}
                    className={`min-h-[40px] px-4 py-1.5 text-xs font-mono font-bold rounded-xl cursor-pointer ${
                      unoCalled
                        ? 'bg-yellow-400 text-black'
                        : 'bg-[#1A180F] text-yellow-300 border border-yellow-500/45'
                    }`}
                  >
                    Call UNO!
                  </button>
                  <button
                    type="button"
                    onClick={initUnoMatch}
                    className="min-h-[40px] px-3.5 py-1.5 text-xs font-mono text-neutral-200 bg-[#141414] border border-yellow-500/25 rounded-xl cursor-pointer"
                  >
                    New Match
                  </button>
                </div>
              </div>

              <FannedCardHand
                count={unoPlayerHand.length}
                renderCard={(idx, fanAngle, arcOffsetY) => {
                  const c = unoPlayerHand[idx];
                  const playable = canPlayUnoCard(c);
                  const marked = unoMulliganIds.includes(c.id);
                  return (
                    <TactileUnoCard
                      key={c.id}
                      id={c.id}
                      color={c.color}
                      label={c.label}
                      size="md"
                      dealIndex={idx}
                      fanAngle={fanAngle}
                      arcOffsetY={arcOffsetY}
                      isPlayable={!unoMulliganMode && playable && unoTurn === 'player'}
                      isMulliganMarked={unoMulliganMode && marked}
                      onClick={() => {
                        if (unoMulliganMode) {
                          setUnoMulliganIds((prev) =>
                            prev.includes(c.id)
                              ? prev.filter((id) => id !== c.id)
                              : [...prev, c.id]
                          );
                        } else {
                          playUnoCard(c, unoPreferredWildColor);
                        }
                      }}
                      onInspect={(payload, anchor) => setInspectedCard({ payload, anchor })}
                    />
                  );
                }}
              />
            </div>
          </div>
        )}

        {/* ==================== 6. EXPANDED 78-CARD TAROT & ASTROLOGY ORACLE (LAST TAB, SILENT) ==================== */}
        {activeGame === 'tarot' && (
          <div className="rounded-2xl bg-[#0B0A06] border border-yellow-500/40 p-4 sm:p-7 shadow-2xl space-y-6">
            {/* Top Oracle Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-yellow-500/25">
              <div>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-yellow-400 font-mono font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>AUTHENTIC 78-CARD RIDER-WAITE-SMITH TAROT &amp; NATAL ASTROLOGY ORACLE</span>
                </div>
                <div className="text-sm sm:text-base font-semibold text-yellow-50 mt-1 leading-snug">
                  {tarotBanner}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-[#14130D] border border-yellow-500/35 rounded-xl overflow-x-auto no-scrollbar">
                  {(
                    [
                      { id: 'destiny_3', label: '3-Card Destiny' },
                      { id: 'celtic_5', label: '5-Card Celtic Cross' },
                      { id: 'zodiac_12_houses', label: '12 Astrological Houses' },
                      { id: 'astrology_trial', label: 'Celestial Trial of Fate' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setTarotMode(m.id);
                        dealNewTarotReading(m.id, false);
                      }}
                      className={`min-h-[40px] px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                        tarotMode === m.id
                          ? 'bg-yellow-400 text-black'
                          : 'text-neutral-200 hover:text-yellow-300'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => dealNewTarotReading(tarotMode, false)}
                  className="min-h-[42px] flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#16150E] hover:bg-yellow-400 hover:text-black text-yellow-300 border border-yellow-500/45 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Shuffle 78-Card Deck</span>
                </button>
              </div>
            </div>

            {/* Full Natal Chart Triad (Sun, Moon & Rising) + Querent Intention */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-5 bg-[#12110B] border border-yellow-500/30 rounded-2xl">
              <div className="lg:col-span-8 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-mono font-bold text-yellow-300">
                    NATAL CHART TRIAD (SELECT SUN, MOON, OR RISING SLOT THEN PICK ZODIAC SIGN):
                  </span>
                  <span className="text-xs font-mono text-yellow-100">
                    Editing:{' '}
                    <strong className="text-yellow-400 uppercase">{activeNatalSlot} Sign</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveNatalSlot('sun')}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      activeNatalSlot === 'sun'
                        ? 'bg-[#211D0B] border-yellow-400 ring-1 ring-yellow-300'
                        : 'bg-[#0B0A07] border-yellow-500/25 hover:border-yellow-400/60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-mono text-yellow-400 font-bold">
                      <Sun className="w-3.5 h-3.5" />
                      <span>☉ SUN SIGN (CORE WILL)</span>
                    </div>
                    <div className="text-base font-bold text-yellow-50 mt-1">
                      {sunProfile.glyph} {sunProfile.sign}
                    </div>
                    <div className="text-xs text-neutral-300 mt-0.5">
                      {sunProfile.element} · {sunProfile.modality} · {sunProfile.ruler}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveNatalSlot('moon')}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      activeNatalSlot === 'moon'
                        ? 'bg-[#211D0B] border-yellow-400 ring-1 ring-yellow-300'
                        : 'bg-[#0B0A07] border-yellow-500/25 hover:border-yellow-400/60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-mono text-yellow-400 font-bold">
                      <Moon className="w-3.5 h-3.5" />
                      <span>☽ MOON SIGN (EMOTION)</span>
                    </div>
                    <div className="text-base font-bold text-yellow-50 mt-1">
                      {moonProfile.glyph} {moonProfile.sign}
                    </div>
                    <div className="text-xs text-neutral-300 mt-0.5">
                      {moonProfile.element} · {moonProfile.modality} · {moonProfile.ruler}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveNatalSlot('rising')}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      activeNatalSlot === 'rising'
                        ? 'bg-[#211D0B] border-yellow-400 ring-1 ring-yellow-300'
                        : 'bg-[#0B0A07] border-yellow-500/25 hover:border-yellow-400/60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-mono text-yellow-400 font-bold">
                      <Star className="w-3.5 h-3.5" />
                      <span>↑ RISING / ASCENDANT</span>
                    </div>
                    <div className="text-base font-bold text-yellow-50 mt-1">
                      {risingProfile.glyph} {risingProfile.sign}
                    </div>
                    <div className="text-xs text-neutral-300 mt-0.5">
                      {risingProfile.element} · {risingProfile.modality} · {risingProfile.ruler}
                    </div>
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
                  {ZODIAC_SIGNS.map((z) => {
                    const currentSignForSlot =
                      activeNatalSlot === 'sun'
                        ? sunSign
                        : activeNatalSlot === 'moon'
                        ? moonSign
                        : risingSign;
                    const isActive = currentSignForSlot === z.sign;
                    return (
                      <button
                        key={z.sign}
                        type="button"
                        onClick={() => {
                          if (activeNatalSlot === 'sun') setSunSign(z.sign);
                          else if (activeNatalSlot === 'moon') setMoonSign(z.sign);
                          else setRisingSign(z.sign);
                        }}
                        className={`min-h-[40px] px-2 py-2 rounded-lg text-xs font-mono border flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-yellow-400 text-black border-yellow-200 font-bold shadow-sm'
                            : 'bg-[#090907] text-yellow-100 border-yellow-500/25 hover:border-yellow-400'
                        }`}
                      >
                        <span>{z.glyph}</span>
                        <span className="truncate">{z.sign}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-xs sm:text-sm font-mono font-bold text-yellow-300 block">
                    QUERENT ORACLE INTENTION
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        'Cosmic Destiny',
                        'Love & Twin Flame',
                        'Wealth & Career',
                        'Shadow & Karma',
                      ] as const
                    ).map((focus) => (
                      <button
                        key={focus}
                        type="button"
                        onClick={() => setQuerentFocus(focus)}
                        className={`min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border cursor-pointer transition-colors ${
                          querentFocus === focus
                            ? 'bg-yellow-400 text-black border-yellow-200 font-bold'
                            : 'bg-[#090907] text-yellow-100 border-yellow-500/25 hover:border-yellow-400'
                        }`}
                      >
                        {focus}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0B0A07] border border-yellow-500/25 text-xs sm:text-sm text-yellow-100 space-y-1">
                  <div className="font-mono font-bold text-yellow-400">
                    Active Natal Triad Elements:
                  </div>
                  <p className="text-neutral-200 leading-relaxed">
                    ☉ {sunProfile.element} · ☽ {moonProfile.element} · ↑ {risingProfile.element}. Cards matching any of your 3 signs add bonus Celestial Resonance!
                  </p>
                </div>
              </div>
            </div>

            {tarotMode !== 'astrology_trial' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 space-y-5">
                  <div className="p-4 sm:p-6 rounded-2xl bg-[#100E08] border border-yellow-500/35 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs sm:text-sm font-mono uppercase tracking-wider text-yellow-300 font-bold">
                        {tarotMode === 'destiny_3'
                          ? '3-Card Past · Present · Future Altar'
                          : tarotMode === 'celtic_5'
                          ? '5-Card Celtic Cross Esoteric Altar'
                          : '12-House Astrological Zodiac Wheel Spread'}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => dealNewTarotReading(tarotMode, true)}
                          className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-mono font-bold bg-[#1C190E] hover:bg-yellow-400 hover:text-black text-yellow-200 border border-yellow-400/50 cursor-pointer transition-colors"
                        >
                          Deal Face-Down (3D Flip)
                        </button>
                        <button
                          type="button"
                          onClick={revealAllSpreadCards}
                          className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-mono font-bold bg-[#1C190E] hover:bg-yellow-400 hover:text-black text-yellow-200 border border-yellow-400/50 cursor-pointer transition-colors"
                        >
                          Reveal All Cards
                        </button>
                        <button
                          type="button"
                          onClick={completeOracleReadingAndClaim}
                          className="min-h-[42px] flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-bold bg-yellow-400 hover:bg-yellow-300 text-black shadow-[0_0_20px_rgba(250,204,21,0.3)] cursor-pointer transition-colors"
                        >
                          <Trophy className="w-3.5 h-3.5" />
                          <span>Complete Reading (+Chips &amp; +1 Pt)</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-4 py-2">
                      {tarotSpread.map((card, idx) => {
                        const slotLabels3 = ['I · THE PAST', 'II · THE PRESENT', 'III · THE FUTURE'];
                        const slotLabels5 = [
                          'I · THE SIGNIFIER',
                          'II · THE CROSSING',
                          'III · ROOT CAUSE',
                          'IV · CROWN POTENTIAL',
                          'V · DESTINY OUTCOME',
                        ];
                        const houseInfo = TWELVE_ASTROLOGICAL_HOUSES[idx];
                        const slotLabel =
                          tarotMode === 'zodiac_12_houses'
                            ? `${houseInfo?.houseNum || idx + 1} · ${houseInfo?.naturalSign || ''}`
                            : tarotMode === 'celtic_5'
                            ? slotLabels5[idx]
                            : slotLabels3[idx];

                        return renderTarotCardVisual(
                          card,
                          slotLabel,
                          () => revealSpreadCard(idx),
                          inspectedTarotCard?.id === card.id,
                          tarotMode === 'zodiac_12_houses',
                          idx
                        );
                      })}
                    </div>

                    <div className="p-5 rounded-xl bg-[#090805] border border-yellow-500/35 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-mono">
                        <span className="text-yellow-400 font-bold">
                          ASTROLOGICAL NATAL SYNTHESIS &amp; PROPHECY
                        </span>
                        <span className="text-yellow-200 font-semibold tabular-nums">
                          Cosmic Resonance:{' '}
                          <strong className="text-yellow-400">
                            {spreadAstrologySynthesis.resonanceScore} Pts
                          </strong>{' '}
                          · Dominant Element:{' '}
                          <strong className="text-yellow-400">
                            {spreadAstrologySynthesis.dominantElement}
                          </strong>
                        </span>
                      </div>
                      <p className="text-sm sm:text-base text-yellow-50/95 leading-relaxed">
                        {spreadAstrologySynthesis.prophecySummary}
                      </p>
                    </div>

                    {elementalDignities.length > 0 && (
                      <div className="p-4 rounded-xl bg-[#0D0C08] border border-yellow-500/30 space-y-3">
                        <div className="flex items-center justify-between text-xs sm:text-sm font-mono text-yellow-300 font-bold">
                          <span className="flex items-center gap-1.5">
                            <Flame className="w-4 h-4 text-yellow-400" />
                            <span>ELEMENTAL DIGNITIES (ADJACENT CARD SYNERGY)</span>
                          </span>
                          <span className="text-yellow-400 tabular-nums">
                            +{spreadAstrologySynthesis.dignityBonus} Resonance Pts
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {elementalDignities.slice(0, 6).map((dig, i) => (
                            <div
                              key={i}
                              className="p-3 rounded-xl bg-[#14120B] border border-yellow-500/20 space-y-1 text-xs sm:text-sm"
                            >
                              <div className="flex items-center justify-between font-mono font-bold text-yellow-200">
                                <span className="truncate">{dig.pairLabel}</span>
                                <span className="text-yellow-400 shrink-0 ml-2">+{dig.bonusScore}</span>
                              </div>
                              <div className="text-xs font-mono text-yellow-400/90">
                                {dig.elementsLabel} · {dig.dignityType}
                              </div>
                              <p className="text-neutral-200 text-xs leading-relaxed">
                                {dig.explanation}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Esoteric Tarot Grimoire Inspector */}
                <div className="lg:col-span-4 rounded-2xl bg-[#100E08] border border-yellow-500/40 p-5 space-y-4">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-mono uppercase tracking-wider text-yellow-400 font-bold">
                    <Compass className="w-4 h-4" />
                    <span>Esoteric Tarot Grimoire Inspector</span>
                  </div>

                  {inspectedTarotCard ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-[#090805] border border-yellow-500/35 space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono text-yellow-300">
                          <span className="font-bold">
                            {inspectedTarotCard.arcana.toUpperCase()} ARCANA ·{' '}
                            {inspectedTarotCard.romanOrRank}
                          </span>
                          <span
                            className={
                              inspectedTarotCard.isReversed
                                ? 'text-amber-400 font-bold'
                                : 'text-yellow-400 font-bold'
                            }
                          >
                            {inspectedTarotCard.isReversed ? '↓ REVERSED' : '↑ UPRIGHT'}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-yellow-50 font-display">
                          {inspectedTarotCard.name}
                        </h3>
                        <div className="text-xs sm:text-sm font-mono text-yellow-300">
                          Ruler: {inspectedTarotCard.astrologyRuler}
                        </div>
                        <div className="text-xs sm:text-sm text-neutral-200">
                          Element:{' '}
                          <strong className="text-yellow-200">{inspectedTarotCard.element}</strong> ·
                          Zodiac Affinity:{' '}
                          <span className="text-yellow-100">
                            {inspectedTarotCard.zodiacAffinity.join(', ')}
                          </span>
                        </div>
                        <div className="pt-1.5 border-t border-yellow-500/20 text-xs text-yellow-200/90 font-mono space-y-1">
                          <div>Kabbalah / Decan: {inspectedTarotCard.kabbalahPathOrDecan}</div>
                          <div>Numerology: {inspectedTarotCard.numerologyNote}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {inspectedTarotCard.keywords.map((kw) => (
                          <span
                            key={kw}
                            className="px-3 py-1 rounded-lg bg-yellow-400/15 border border-yellow-400/40 text-xs font-mono font-semibold text-yellow-200"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>

                      <div className="p-4 rounded-xl bg-[#14120A] border border-yellow-500/35 space-y-1.5">
                        <div className="text-xs font-mono uppercase text-yellow-400 font-bold">
                          {inspectedTarotCard.isReversed
                            ? 'Active Shadow Prophecy (Reversed):'
                            : 'Active Divination Prophecy (Upright):'}
                        </div>
                        <p className="text-sm sm:text-base text-yellow-50 leading-relaxed">
                          {inspectedTarotCard.isReversed
                            ? inspectedTarotCard.reversedMeaning
                            : inspectedTarotCard.uprightMeaning}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#090805] border border-yellow-500/20 space-y-1 text-xs sm:text-sm text-neutral-300">
                        <div className="font-mono text-yellow-300/90 font-semibold">
                          {inspectedTarotCard.isReversed
                            ? 'Upright Counterpart:'
                            : 'Shadow / Reversed Warning:'}
                        </div>
                        <p className="leading-relaxed">
                          {inspectedTarotCard.isReversed
                            ? inspectedTarotCard.uprightMeaning
                            : inspectedTarotCard.reversedMeaning}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl bg-[#090805] border border-yellow-500/25 text-sm text-neutral-200 leading-relaxed">
                      Tap any Tarot card on the altar to reveal it and inspect its Planetary Ruler, Kabbalistic Path, Numerology, Elemental Dignity, and Divination Prophecy.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* MODE D: CELESTIAL TRIAL OF FATE */
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {trialHouses.map((house, idx) => {
                    const isTarget = selectedTrialHouseIdx === idx && !house.playedCard;
                    return (
                      <button
                        key={house.houseTitle}
                        type="button"
                        onClick={() => setSelectedTrialHouseIdx(idx)}
                        className={`p-5 rounded-2xl border text-left transition-all flex flex-col justify-between min-h-[220px] cursor-pointer ${
                          isTarget
                            ? 'bg-[#17150A] border-2 border-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.2)]'
                            : 'bg-[#0E0D08] border-yellow-500/30'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-mono text-yellow-400">
                            <span className="font-bold">TARGET: {house.targetElement.toUpperCase()}</span>
                            <span>RESONANCE: {house.rulingSign.toUpperCase()}</span>
                          </div>
                          <div className="text-base font-bold text-yellow-100 font-display">
                            {house.houseTitle}
                          </div>
                          <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed">
                            {house.prophecyPrompt}
                          </p>
                        </div>

                        {house.playedCard ? (
                          <div className="mt-4 p-3.5 rounded-xl bg-yellow-400/15 border border-yellow-400/50 flex items-center justify-between">
                            <div>
                              <div className="text-sm font-bold text-yellow-200">
                                {house.playedCard.name}
                              </div>
                              <div className="text-xs font-mono text-yellow-400 mt-0.5">
                                {house.playedCard.element} ·{' '}
                                {house.playedCard.astrologyRuler.split('·')[0]}
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded bg-yellow-400 text-black font-mono text-xs font-bold">
                              SEALED
                            </span>
                          </div>
                        ) : (
                          <div className="mt-4 p-3 rounded-xl border border-dashed border-yellow-500/40 text-center text-xs font-mono text-yellow-300/90">
                            {isTarget
                              ? '★ Selected House — Tap a Tarot Card Below'
                              : 'Tap to Select House'}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <div className="text-xs sm:text-sm font-mono uppercase tracking-wider text-yellow-300 font-bold">
                    Your 6-Card Esoteric Hand (Tap a Tarot Card to Channel into the Selected House):
                  </div>
                  <div className="flex items-center justify-start sm:justify-center gap-4 overflow-x-auto no-scrollbar py-2">
                    {trialHand.map((card, idx) =>
                      renderTarotCardVisual(
                        card,
                        `Power ${card.celestialPower}`,
                        () => assignCardToTrialHouse(card),
                        false,
                        false,
                        idx
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Safe-Edge Card Zoom & Nested Keyword Inspector */}
      <CardZoomInspectorOverlay
        inspected={inspectedCard}
        onClose={() => setInspectedCard(null)}
      />

      {/* Chronological Action Log Drawer */}
      <ActionHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        entries={actionLog}
      />

      {/* Pile Browser Modal (Waste / Discard / Foundations / Deck Suits) */}
      <PileBrowserModal
        isOpen={isPileBrowserOpen}
        onClose={() => setIsPileBrowserOpen(false)}
        title="Card Pile & Remaining Deck Inspector"
        piles={currentBrowsablePiles}
      />

      {/* Dedicated Per-Game Victory / Match Complete Modal */}
      <GameWinMenuModal
        payload={winMenuPayload}
        onPlayAgain={handlePlayAgain}
        onDismiss={dismissWinMenu}
        switchGameOptions={CARD_GAME_TABS}
        onSwitchGame={(nextId) => setActiveGame(nextId as CardGameMode)}
      />
    </div>
  );
};
