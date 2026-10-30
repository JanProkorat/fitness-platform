import { StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** The "Not synced yet" note a row shows while its write waits in the outbox; sits in the row's secondary-text slot. */
export function PendingMark() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.mark}>
      <SymbolView
        name="clock.arrow.circlepath"
        weight="medium"
        tintColor={theme.colors.muted}
        size={theme.sizes.pendingGlyph}
      />
      <Text variant="caption" color="muted">
        {t('offlineSync.pending')}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    mark: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xxs,
    },
  });
