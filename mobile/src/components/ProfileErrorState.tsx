import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** Shown when the profile cannot be loaded after signing in; lets the user retry or sign out. */
export function ProfileErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.copy}>
        <Text variant="heading" accessibilityRole="header" style={styles.centered}>
          {t('profileError.title')}
        </Text>
        <Text variant="body" color="muted" style={styles.centered}>
          {t('profileError.body')}
        </Text>
      </View>
      <View style={styles.actions}>
        <Button label={t('profileError.retry')} onPress={onRetry} />
        <Button
          label={t('common.signOut')}
          variant="destructive"
          onPress={() => void useAuthStore.getState().logout()}
        />
      </View>
    </Screen>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      flex: 1,
      justifyContent: 'center',
      gap: theme.spacing.huge,
    },
    copy: {
      gap: theme.spacing.xs,
    },
    centered: {
      textAlign: 'center',
    },
    actions: {
      gap: theme.spacing.md,
    },
  });
