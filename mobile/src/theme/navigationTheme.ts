import type { Theme as NavigationTheme } from 'expo-router';

import type { Theme } from './index';

/** Builds the expo-router navigation theme so headers and backgrounds follow the tokens. */
export function buildNavigationTheme(theme: Theme): NavigationTheme {
  const { colors, typography } = theme;
  return {
    dark: theme.scheme === 'dark',
    colors: {
      primary: colors.accent,
      background: colors.ground,
      card: colors.surface,
      text: colors.ink,
      border: colors.line,
      notification: colors.accent,
    },
    fonts: {
      regular: { fontFamily: typography.body.fontFamily, fontWeight: 'normal' },
      medium: { fontFamily: typography.label.fontFamily, fontWeight: 'normal' },
      bold: { fontFamily: typography.subtitle.fontFamily, fontWeight: 'normal' },
      heavy: { fontFamily: typography.heading.fontFamily, fontWeight: 'normal' },
    },
  };
}
