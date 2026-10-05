import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export type ButtonVariant = 'ink' | 'training' | 'nutrition' | 'destructive';
export type ButtonSize = 'large' | 'small';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

type VariantLook = { background: string; foreground: string; shadow?: string; border?: string };

const resolveLook = (theme: Theme, variant: ButtonVariant): VariantLook => {
  const { colors, shadows } = theme;
  switch (variant) {
    case 'training':
      return { background: colors.training, foreground: colors.onTraining, shadow: shadows.training };
    case 'nutrition':
      return { background: colors.nutrition, foreground: colors.onNutrition, shadow: shadows.nutrition };
    case 'destructive':
      return { background: colors.errorSoft, foreground: colors.error, border: colors.error };
    case 'ink':
      return { background: colors.primary, foreground: colors.onPrimary };
  }
};

export function Button({
  label,
  onPress,
  variant = 'ink',
  size = 'large',
  icon,
  disabled = false,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const look = resolveLook(theme, variant);
  const typeStyle = size === 'large' ? theme.typography.button : theme.typography.buttonSmall;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'large' ? styles.large : styles.small,
        {
          backgroundColor: look.background,
          boxShadow: look.shadow,
          borderColor: look.border,
          borderWidth: look.border ? theme.sizes.border : 0,
        },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[typeStyle, { color: look.foreground }]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      borderRadius: theme.radii.pill,
    },
    large: {
      height: theme.sizes.buttonLarge,
      paddingHorizontal: theme.spacing.xxxl,
    },
    small: {
      height: theme.sizes.buttonSmall,
      paddingHorizontal: theme.spacing.xl,
    },
    icon: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.85,
    },
    disabled: {
      opacity: 0.4,
    },
  });
