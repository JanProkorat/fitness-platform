/** Soft colour glows behind the launch screen; centres are fractions of the screen, radii in px. */
export const launchGlowShapes = {
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
