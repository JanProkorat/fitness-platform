import { StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type HeroIconProps = {
  symbol: SFSymbol;
  tone: 'accent' | 'success' | 'error';
};

/** Large round icon that tops the status screens. */
export function HeroIcon({ symbol, tone }: HeroIconProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const look = {
    success: { background: theme.colors.successSoft, foreground: theme.colors.success },
    error: { background: theme.colors.errorSoft, foreground: theme.colors.error },
    accent: { background: theme.colors.accentSoft, foreground: theme.colors.accent },
  }[tone];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.circle, { backgroundColor: look.background }]}
    >
      <SymbolView name={symbol} tintColor={look.foreground} size={theme.sizes.heroGlyph} />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    circle: {
      width: theme.sizes.heroIcon,
      height: theme.sizes.heroIcon,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
