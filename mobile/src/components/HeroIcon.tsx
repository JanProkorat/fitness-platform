import { StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type HeroIconProps = {
  symbol: SFSymbol;
  tone: 'accent' | 'success';
};

/** Large round icon that tops the status screens. */
export function HeroIcon({ symbol, tone }: HeroIconProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const look =
    tone === 'success'
      ? { background: theme.colors.successSoft, foreground: theme.colors.success }
      : { background: theme.colors.accentSoft, foreground: theme.colors.accent };

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
