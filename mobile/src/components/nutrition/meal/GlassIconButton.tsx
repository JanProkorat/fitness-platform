import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type GlassIconButtonProps = {
  symbol: SFSymbol;
  label: string;
  onPress: () => void;
  busy?: boolean;
};

/** Round glass control for the top bar of a hero screen, styled like `BackButton`. */
export function GlassIconButton({ symbol, label, onPress, busy = false }: GlassIconButtonProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const tint = theme.scheme === 'dark' ? 'systemThinMaterialDark' : 'systemThinMaterialLight';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={styles.shadow}
    >
      <BlurView intensity={theme.glass.control.intensity} tint={tint} style={styles.blur}>
        {busy ? (
          <ActivityIndicator color={theme.colors.ink} />
        ) : (
          <SymbolView name={symbol} weight="medium" tintColor={theme.colors.ink} size={theme.sizes.backIcon} />
        )}
      </BlurView>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    shadow: {
      width: theme.sizes.backButton,
      height: theme.sizes.backButton,
      borderRadius: theme.radii.pill,
      boxShadow: theme.shadows.glass,
    },
    blur: {
      flex: 1,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.glassBorder,
      backgroundColor: theme.colors.glassFill,
    },
  });
