import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type TodayHeaderProps = {
  eyebrow: string;
  title: string;
};

/** Eyebrow, greeting and the notifications bell at the top of the Today tab. */
export function TodayHeader({ eyebrow, title }: TodayHeaderProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text variant="bodyLarge" color="muted">
          {eyebrow}
        </Text>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('today.notifications')}
        style={styles.bell}
      >
        <SymbolView name="bell" tintColor={theme.colors.ink} size={theme.sizes.bellGlyph} />
      </Pressable>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing.xl,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    bell: {
      width: theme.sizes.bellButton,
      height: theme.sizes.bellButton,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
  });
