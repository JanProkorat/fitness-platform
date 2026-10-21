import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type GlassButtonProps = {
  label: string;
  children: ReactNode;
  /** A button without a handler renders disabled. */
  onPress?: () => void;
};

/** Round glass control that holds an icon or initials; the sibling of `BackButton`. */
export function GlassButton({ label, children, onPress }: GlassButtonProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const tint = theme.scheme === 'dark' ? 'systemThinMaterialDark' : 'systemThinMaterialLight';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={styles.shadow}
    >
      <BlurView intensity={theme.glass.control.intensity} tint={tint} style={styles.blur}>
        {children}
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
