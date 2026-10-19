import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** Landing for coach accounts until the coach app exists. */
export default function CoachPendingScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.copy}>
        <Text variant="title" accessibilityRole="header" style={styles.centered}>
          {t('coachPending.title')}
        </Text>
        <Text variant="body" color="muted" style={styles.centered}>
          {t('coachPending.body')}
        </Text>
      </View>
      <Button
        label={t('common.signOut')}
        variant="destructive"
        onPress={() => void useAuthStore.getState().logout()}
      />
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
  });
