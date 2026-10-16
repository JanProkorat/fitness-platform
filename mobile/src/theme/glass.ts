/** Raw board blur values, named by role. Mapping to expo-blur intensity is left to the consumer. */
export type GlassBlur = {
  /** Blur radius in px. */
  blur: number;
  /** Saturation multiplier (1 = unchanged). */
  saturate: number;
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
  bar: { blur: 22, saturate: 1.8 },
  control: { blur: 18, saturate: 1 },
  badge: { blur: 16, saturate: 1 },
};
