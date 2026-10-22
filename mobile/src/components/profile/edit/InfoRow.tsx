import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type InfoRowProps = {
  label: string;
  /** Current answer; a row with none shows "Not set". */
  value: string | null;
  /** What is wrong with the answer, shown under the row. */
  error?: string;
  onPress: () => void;
};

/** One tappable My info answer: label, current value and a chevron. */
export function InfoRow({ label, value, error, onPress }: InfoRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const shown = value && value.length > 0 ? value : t('onboarding.notSet');

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('editProfile.info.rowLabel', { label, value: shown })}
        onPress={onPress}
        style={styles.row}
      >
        <Text variant="body" style={styles.label}>
          {label}
        </Text>
        <Text variant="bodySmall" color="muted" numberOfLines={1} style={styles.value}>
          {shown}
        </Text>
        <SymbolView
          name="chevron.right"
          weight="medium"
          tintColor={theme.colors.muted}
          size={theme.sizes.listChevron}
        />
      </Pressable>
      {error ? (
        <Text variant="label" color="error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.xxs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    label: {
      flexShrink: 0,
    },
    value: {
      flex: 1,
      textAlign: 'right',
    },
    error: {
      textAlign: 'right',
    },
  });
