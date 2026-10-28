import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type PlanStateProps = {
  kind: 'pending' | 'empty' | 'error';
  title?: string;
  body?: string;
  onBack: () => void;
  onRetry?: () => void;
};

/** Full-screen loading, empty or error state of a plan screen, always with a way back. */
export function PlanState({ kind, title, body, onBack, onRetry }: PlanStateProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <Screen gutter={theme.spacing.xl} topGap={theme.spacing.safeAreaGap}>
      <ScreenHeader title="" backLabel={t('onboarding.back')} onBack={onBack} />
      <View style={styles.state}>
        {kind === 'pending' ? (
          <ActivityIndicator color={theme.colors.accent} />
        ) : (
          <>
            <Text variant="heading" accessibilityRole="header" style={styles.centered}>
              {title}
            </Text>
            <Text variant="body" color="muted" style={styles.centered}>
              {body}
            </Text>
            {kind === 'error' && onRetry ? (
              <Button label={t('nutritionPlan.retry')} onPress={onRetry} />
            ) : (
              <Button label={t('nutritionPlan.back')} onPress={onBack} />
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    state: {
      flex: 1,
      justifyContent: 'center',
      gap: theme.spacing.xl,
    },
    centered: {
      textAlign: 'center',
    },
  });
