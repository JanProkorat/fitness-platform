export const spacing = {
  xxs: 4,
  snug: 6,
  xs: 8,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 20,
  xxxl: 24,
  huge: 32,
} as const;

export const radii = {
  xs: 4,
  sm: 10,
  md: 12,
  field: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const sizes = {
  buttonLarge: 52,
  buttonSmall: 32,
  chip: 32,
  field: 48,
  tabBar: 58,
  tabItem: 48,
  tabIcon: 20,
  tabBarBottom: 28,
  tabBarPadding: 5,
  tabItemGap: 2,
  border: 1,
  fieldIcon: 17,
  authTop: 110,
  authBottom: 44,
  wordmarkGap: 22,
  launchMarkWidth: 29,
  launchMarkHeight: 27,
  launchMarkGap: 6.48,
  launchStackGap: 22,
  launchTaglineRise: 8,
} as const;

/** Soft colour glows behind the launch screen; centres are fractions of the screen, radii in px. */
export const launchGlows = {
  top: { rx: 420, ry: 360, x: 0.88, y: 0.1 },
  bottom: { rx: 400, ry: 360, x: 0.08, y: 0.94 },
  corner: { rx: 300, ry: 260, x: 0, y: 0 },
} as const;

/** Launch overlay timings in ms; the sequence plays once and the last frame holds. */
export const launchMotion = {
  total: 2244,
  popDuration: 612,
  popStagger: 100,
  barStart: 1020,
  barDuration: 680,
  barStagger: 120,
  tickStart: 1360,
  tickDuration: 510,
  wordmarkStart: 1088,
  wordmarkDuration: 782,
  taglineStart: 1768,
  taglineDuration: 476,
  exitDuration: 250,
} as const;
