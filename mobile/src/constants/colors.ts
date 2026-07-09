/**
 * Brand colors that don't shift with the active theme. Use these in
 * module-scope constants and hand-written data maps where `useTheme()`
 * isn't reachable. Inside React components, prefer `useTheme().gold`
 * (which has the same value).
 */
export const Brand = {
  gold: '#c9a84c',
} as const

/**
 * iOS system colors (light-mode values). Use these in module-scope
 * StyleSheet.create blocks and data maps where `useTheme()` is not
 * reachable. In render paths, prefer `useTheme().blue` etc. which
 * automatically returns the dark-mode variant.
 *
 * These map directly to the iOS Human Interface Guidelines system palette
 * light values. The names match the `light` scheme object for parity.
 */
export const Static = {
  /** iOS system blue — light: #007aff */
  blue: '#007aff',
  /** iOS system green — light: #34c759 */
  green: '#34c759',
  /** iOS system red — light: #ff3b30 */
  red: '#ff3b30',
  /** iOS system orange — light: #ff9500 */
  orange: '#ff9500',
  /** Deep blue used for new_plan notification accent — #0b6e99 */
  deepBlue: '#0b6e99',
  /** Warning/amber used for former-trainer / verify-email warning — #ad5700 */
  amber: '#ad5700',
  /** Always-white — for text/icons rendered on dark hero overlays and SVG strokes
   *  that must stay white regardless of the active color scheme. */
  alwaysWhite: '#ffffff',
  /** Always-black shadow color — conventional iOS shadowColor value, identical
   *  in both light and dark schemes. Replaces `Colors.dark.shadow` in
   *  module-scope StyleSheet.create where useTheme() is not available. */
  shadow: '#000000',
} as const

/** Shared gold alpha values used across components */
export const goldAlpha = {
  '04': 'rgba(201,168,76,0.04)',
  '06': 'rgba(201,168,76,0.06)',
  '07': 'rgba(201,168,76,0.07)',
  '08': 'rgba(201,168,76,0.08)',
  '10': 'rgba(201,168,76,0.10)',
  '12': 'rgba(201,168,76,0.12)',
  '15': 'rgba(201,168,76,0.15)',
  '18': 'rgba(201,168,76,0.18)',
  '20': 'rgba(201,168,76,0.20)',
  '25': 'rgba(201,168,76,0.25)',
  '35': 'rgba(201,168,76,0.35)',
  solid: 'rgba(201,168,76,1)',
} as const

/**
 * Scheme-aware green alpha values for diary-request and other green-tinted
 * surfaces. Light uses iOS system green (#34c759); dark uses the dark-mode
 * system green (#30d158).
 */
export const greenAlpha = {
  light: {
    bg: 'rgba(52,199,89,0.07)',
    border: 'rgba(52,199,89,0.22)',
    iconBg: 'rgba(52,199,89,0.15)',
    /** Dark legible green for eyebrow text on a light-tinted background. */
    eyebrow: '#1f8a3e',
  },
  dark: {
    bg: 'rgba(48,209,88,0.10)',
    border: 'rgba(48,209,88,0.28)',
    iconBg: 'rgba(48,209,88,0.18)',
    /** Bright readable green for eyebrow text on a dark-tinted background. */
    eyebrow: '#30d158',
  },
} as const

const light = {
  // Backgrounds
  bg: '#f2f2f7',
  bg2: '#ffffff',
  bg3: '#f2f2f7',

  // Separators
  sep: 'rgba(60,60,67,0.18)',
  sep2: 'rgba(60,60,67,0.09)',

  // Labels
  label: '#000000',
  label2: 'rgba(60,60,67,0.6)',
  label3: 'rgba(60,60,67,0.3)',

  // Fills (interactive elements)
  fill: 'rgba(120,120,128,0.12)',
  fill2: 'rgba(120,120,128,0.08)',
  /** Ultra-light neutral tint (~6% alpha) — matches .tp-section-header bg in prototype. */
  fill3: 'rgba(120,120,128,0.06)',

  // System
  blue: '#007aff',
  green: '#34c759',
  red: '#ff3b30',
  orange: '#ff9500',
  purple: '#af52de',

  // Brand
  gold: Brand.gold,
  goldBg: 'rgba(201,168,76,0.10)',

  // Static (constant regardless of theme)
  onAccent: '#ffffff',   // Text/icons on accent backgrounds (gold buttons, dark heroes)
  heroBg: '#1a2332',     // Dark hero section background (training card)
  nutritionHeroStart: '#0d2137', // Nutrition hero gradient start (dark blue)
  nutritionHeroEnd: '#1a3a52',   // Nutrition hero gradient end (mid blue)
  trainingHeroStart: '#1a1a2e', // Training plan hero gradient start (dark navy)
  trainingHeroEnd: '#16213e',   // Training plan hero gradient end (mid navy)
  systemGray: '#8e8e93', // Neutral gray (swipe actions, secondary UI)
  /** Foreground for content on the gold-tinted chip backgrounds — stays black
   *  in both light and dark themes because the chip itself is mid-luminance. */
  onGoldChip: '#000000',
  /** Conventional iOS shadowColor — same value in both themes. */
  shadow: '#000000',
  /** Semi-transparent overlay for floating controls on image surfaces
   *  (e.g. remove-button over a photo thumbnail). Works in both themes. */
  overlay: 'rgba(0,0,0,0.45)',

  // Macros — match the system colours used in the NutritionCardHero chips
  macroProtein: '#007aff',  // blue
  macroCarbs: '#ff9500',    // orange
  macroFat: '#af52de',      // purple
  macroFiber: '#34c759',    // green
} as const

const dark = {
  bg: '#1c1c1e',
  bg2: '#2c2c2e',
  bg3: '#1c1c1e',

  sep: 'rgba(84,84,88,0.65)',
  sep2: 'rgba(84,84,88,0.40)',

  label: '#ffffff',
  label2: 'rgba(235,235,245,0.6)',
  label3: 'rgba(235,235,245,0.3)',

  fill: 'rgba(120,120,128,0.24)',
  fill2: 'rgba(120,120,128,0.16)',
  /** Ultra-light neutral tint (~6% alpha) — matches .tp-section-header bg in prototype. */
  fill3: 'rgba(120,120,128,0.06)',

  blue: '#0a84ff',
  green: '#30d158',
  red: '#ff453a',
  orange: '#ff9f0a',
  purple: '#bf5af2',

  gold: Brand.gold,
  goldBg: 'rgba(201,168,76,0.15)',

  // Static (constant regardless of theme)
  onAccent: '#ffffff',
  heroBg: '#1a2332',
  nutritionHeroStart: '#0d2137',
  nutritionHeroEnd: '#1a3a52',
  trainingHeroStart: '#1a1a2e', // Training plan hero gradient start (dark navy)
  trainingHeroEnd: '#16213e',   // Training plan hero gradient end (mid navy)
  systemGray: '#636366',
  /** Foreground for content on the gold-tinted chip backgrounds — stays black
   *  in both light and dark themes because the chip itself is mid-luminance. */
  onGoldChip: '#000000',
  /** Conventional iOS shadowColor — same value in both themes. */
  shadow: '#000000',
  /** Semi-transparent overlay for floating controls on image surfaces
   *  (e.g. remove-button over a photo thumbnail). Works in both themes. */
  overlay: 'rgba(0,0,0,0.45)',

  // Macros — match the system colours used in the NutritionCardHero chips
  macroProtein: '#0a84ff',  // blue
  macroCarbs: '#ff9f0a',    // orange
  macroFat: '#bf5af2',      // purple
  macroFiber: '#30d158',    // green
} as const

export interface ColorScheme {
  readonly bg: string
  readonly bg2: string
  readonly bg3: string
  readonly sep: string
  readonly sep2: string
  readonly label: string
  readonly label2: string
  readonly label3: string
  readonly fill: string
  readonly fill2: string
  /** Ultra-light neutral tint (~6% alpha) — matches .tp-section-header bg in prototype. */
  readonly fill3: string
  readonly blue: string
  readonly green: string
  readonly red: string
  readonly orange: string
  readonly purple: string
  readonly gold: string
  readonly goldBg: string
  readonly onAccent: string
  readonly heroBg: string
  readonly nutritionHeroStart: string
  readonly nutritionHeroEnd: string
  readonly trainingHeroStart: string
  readonly trainingHeroEnd: string
  readonly systemGray: string
  readonly onGoldChip: string
  readonly shadow: string
  readonly macroProtein: string
  readonly macroCarbs: string
  readonly macroFat: string
  readonly macroFiber: string
  readonly overlay: string
  /** True when the effective color scheme is dark. Use instead of `colors.bg === '#1c1c1e'`. */
  readonly isDark: boolean
}

export const Colors = { light, dark } as const
