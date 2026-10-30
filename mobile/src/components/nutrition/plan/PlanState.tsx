import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type PlanStateProps = {
  kind: 'pending' | 'empty' | 'error' | 'offline';
  title?: string;
  body?: string;
  /** Leave out on a tab root: there is nothing to go back to, so no header back button or Back action. */
  onBack?: () => void;
  onRetry?: () => void;
};

/**
 * Full-screen loading, empty, error or not-saved-offline state of a screen.
 * The offline kind has no Retry: the screen loads by itself once the connection is back.
 */
export function PlanState({ kind, title, body, onBack, onRetry }: PlanStateProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const heading = kind === 'offline' ? t('offline.notSaved.title') : title;
  const message = kind === 'offline' ? t('offline.notSaved.body') : body;

  return (
    <Screen gutter={theme.spacing.xl} topGap={theme.spacing.safeAreaGap}>
      {onBack ? (
        <ScreenHeader title="" backLabel={t('onboarding.back')} onBack={onBack} />
      ) : (
        <OfflineBanner />
      )}
      <View style={styles.state}>
        {kind === 'pending' ? (
          <ActivityIndicator color={theme.colors.accent} />
        ) : (
          <>
            {kind === 'offline' ? (
              <View style={styles.iconCircle}>
                <SymbolView
                  name="icloud.slash"
                  weight="medium"
                  tintColor={theme.colors.muted}
                  size={theme.sizes.offlineGlyph}
                />
              </View>
            ) : null}
            <Text variant="heading" accessibilityRole="header" style={styles.centered}>
              {heading}
            </Text>
            <Text variant="body" color="muted" style={styles.centered}>
              {message}
            </Text>
            {kind === 'error' && onRetry ? (
              <Button label={t('nutritionPlan.retry')} onPress={onRetry} />
            ) : onBack && kind === 'offline' ? (
              <Pressable
                accessibilityRole="button"
                onPress={onBack}
                style={({ pressed }) => [styles.quietPill, pressed && styles.pressed]}
              >
                <Text variant="bodyStrong">{t('nutritionPlan.back')}</Text>
              </Pressable>
            ) : onBack ? (
              <Button label={t('nutritionPlan.back')} onPress={onBack} />
            ) : null}
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
    iconCircle: {
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      width: theme.sizes.offlineIcon,
      height: theme.sizes.offlineIcon,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.tabSelected,
    },
    quietPill: {
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      height: theme.sizes.quietButton,
      paddingHorizontal: theme.sizes.quietButtonInset,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.quietPill,
    },
    pressed: {
      opacity: theme.opacity.pressed,
    },
  });
