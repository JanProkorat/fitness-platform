import { Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type BackButtonProps = {
  label: string;
  onPress: () => void;
};

/** Round glass control for the top-left corner of a screen. */
export function BackButton({ label, onPress }: BackButtonProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const tint = theme.scheme === 'dark' ? 'systemThinMaterialDark' : 'systemThinMaterialLight';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.shadow}
    >
      <BlurView intensity={theme.glass.control.intensity} tint={tint} style={styles.blur}>
        <SymbolView
          name="chevron.left"
          weight="medium"
          tintColor={theme.colors.ink}
          size={theme.sizes.backIcon}
        />
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
