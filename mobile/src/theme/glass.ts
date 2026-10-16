/** Board blur values by role, plus the expo-blur intensity that renders them. */
export type GlassBlur = {
  /** Blur radius in px. */
  blur: number;
  /** Saturation multiplier (1 = unchanged). */
  saturate: number;
  /** expo-blur intensity (0–100); bar was tuned in the simulator, the others scale linearly with `blur`. */
  intensity: number;
};

export type Glass = {
  /** Tab bars, headers and sheets. */
  bar: GlassBlur;
  /** Round controls floating over imagery, such as an overlay back button. */
  control: GlassBlur;
  /** Small badges over media, such as a play button. */
  badge: GlassBlur;
};

export const glass: Glass = {
  bar: { blur: 22, saturate: 1.8, intensity: 50 },
  control: { blur: 18, saturate: 1, intensity: 41 },
  badge: { blur: 16, saturate: 1, intensity: 36 },
};
