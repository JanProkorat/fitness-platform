import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export type ChipVariant = 'training' | 'nutrition';

type ChipProps = {
  label: string;
  variant: ChipVariant;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Chip({ label, variant, icon, style }: ChipProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { colors } = theme;
  const look =
    variant === 'training'
      ? { background: colors.trainingSoft, foreground: colors.trainingInk }
      : { background: colors.nutritionSoft, foreground: colors.nutritionInk };

  return (
    <View style={[styles.base, { backgroundColor: look.background }, style]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[theme.typography.labelStrong, { color: look.foreground }]}>{label}</Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: theme.spacing.xxs,
      height: theme.sizes.chip,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.pill,
    },
    icon: {
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
