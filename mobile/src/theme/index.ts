import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, shadowColors } from './colors';
import type { ColorScheme, Colors } from './colors';
import { radii, sizes, spacing } from './spacing';
import { fontAssets, textStyle, typography } from './typography';

export type { ColorScheme, Colors } from './colors';
export type { FontFamily, TypeStyle, TypographyRole } from './typography';
export { fontAssets, textStyle, typography };
export { radii, sizes, spacing };

export type Theme = {
  scheme: ColorScheme;
  colors: Colors;
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
  sizes: typeof sizes;
  shadows: { training: string; nutrition: string };
};

const buildShadow = (color: string): string => `0px 6px 16px 0px ${color}`;

const buildTheme = (scheme: ColorScheme): Theme => ({
  scheme,
  colors: scheme === 'dark' ? darkColors : lightColors,
  typography,
  spacing,
  radii,
  sizes,
  shadows: {
    training: buildShadow(shadowColors.training),
    nutrition: buildShadow(shadowColors.nutrition),
  },
});

const themes: Record<ColorScheme, Theme> = {
  light: buildTheme('light'),
  dark: buildTheme('dark'),
};

/** Resolves the theme from the OS colour scheme; unspecified falls back to light. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return useMemo(() => themes[scheme === 'dark' ? 'dark' : 'light'], [scheme]);
}
