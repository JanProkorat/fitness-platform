import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors } from './colors';
import type { ColorScheme, Colors } from './colors';
import { glass } from './glass';
import type { Glass, GlassBlur } from './glass';
import { buildShadows } from './shadows';
import type { Shadows } from './shadows';
import { radii, sizes, spacing } from './spacing';
import { fontAssets, textStyle, typography } from './typography';

export type { ColorScheme, Colors } from './colors';
export type { FontFamily, TypeStyle, TypographyRole } from './typography';
export { fontAssets, textStyle, typography };
export type { Glass, GlassBlur, Shadows };
export { glass, radii, sizes, spacing };

export type Theme = {
  scheme: ColorScheme;
  colors: Colors;
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
  sizes: typeof sizes;
  shadows: Shadows;
  glass: Glass;
};

const buildTheme = (scheme: ColorScheme): Theme => {
  const colors = scheme === 'dark' ? darkColors : lightColors;
  return {
    scheme,
    colors,
    typography,
    spacing,
    radii,
    sizes,
    shadows: buildShadows(scheme, colors),
    glass,
  };
};

const themes: Record<ColorScheme, Theme> = {
  light: buildTheme('light'),
  dark: buildTheme('dark'),
};

/** Resolves the theme from the OS colour scheme; unspecified falls back to light. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return useMemo(() => themes[scheme === 'dark' ? 'dark' : 'light'], [scheme]);
}
