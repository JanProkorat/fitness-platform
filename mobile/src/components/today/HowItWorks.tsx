import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const STEPS = [1, 2, 3] as const;

/** Three numbered steps from picking a coach to following the plan; step 1 is emphasised. */
export function HowItWorks() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.section}>
      <Text variant="overline" color="muted" style={styles.overline}>
        {t('today.howItWorks.title').toUpperCase()}
      </Text>
      <View style={styles.card}>
        {STEPS.map((step) => (
          <View key={step} style={styles.step}>
            <View style={[styles.badge, step === 1 && styles.badgeFirst]}>
              <Text
                variant="captionStrong"
                color={step === 1 ? 'onPrimary' : 'ink'}
                accessibilityElementsHidden
              >
                {step}
              </Text>
            </View>
            <View style={styles.copy}>
              <Text variant="bodyStrong">{t(`today.howItWorks.step${step}.title`)}</Text>
              <Text variant="caption" color="muted">
                {t(`today.howItWorks.step${step}.body`)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    section: {
      gap: theme.spacing.xs,
    },
    overline: {
      letterSpacing: theme.typography.overline.letterSpacing,
    },
    card: {
      gap: theme.spacing.lg,
      padding: theme.spacing.xl,
      borderRadius: theme.radii.card,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    step: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.md,
    },
    badge: {
      width: theme.sizes.stepNumber,
      height: theme.sizes.stepNumber,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.stepIdle,
    },
    badgeFirst: {
      backgroundColor: theme.colors.primary,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs / 2,
    },
  });
