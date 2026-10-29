import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type NextPlanStripProps = {
  title: string;
  subtitle: string;
  onPress: () => void;
};

/** "Next plan is ready" at the bottom of a running card; opens that plan. */
export function NextPlanStrip({ title, subtitle, onPress }: NextPlanStripProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      style={styles.strip}
    >
      <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <SymbolView name="calendar" tintColor={theme.colors.ink} size={theme.sizes.rowGlyph} />
      </View>
      <View style={styles.copy}>
        <Text variant="labelStrong">{title}</Text>
        <Text variant="caption" color="muted" numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <SymbolView name="chevron.right" tintColor={theme.colors.muted} size={theme.sizes.coachChevron} />
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    strip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.nutritionSoft,
    },
    icon: {
      width: theme.sizes.quickIcon,
      height: theme.sizes.quickIcon,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs / 2,
    },
  });
