import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const NEXT_STEPS: { key: 'aboutYou' | 'findCoach'; symbol: SFSymbol }[] = [
  { key: 'aboutYou', symbol: 'person' },
  { key: 'findCoach', symbol: 'figure.strengthtraining.traditional' },
];

/** The "what's next" list shown once an email is confirmed. */
export function VerifiedNextSteps() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.next}>
      <Text variant="overline" color="muted" style={styles.overline}>
        {t('verified.next')}
      </Text>
      <Card style={styles.steps}>
        {NEXT_STEPS.map(({ key, symbol }, index) => (
          <View key={key} style={[styles.step, index > 0 && styles.stepDivider]}>
            <View style={styles.stepIcon}>
              <SymbolView name={symbol} tintColor={theme.colors.ink2} size={theme.sizes.rowGlyph} />
            </View>
            <View style={styles.stepCopy}>
              <Text variant="bodyStrong">{t(`verified.${key}.title`)}</Text>
              <Text variant="caption" color="muted">
                {t(`verified.${key}.hint`)}
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    next: {
      gap: theme.spacing.xxs,
    },
    overline: {
      letterSpacing: theme.typography.overline.letterSpacing,
    },
    steps: {
      paddingVertical: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.xl,
    },
    step: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    stepDivider: {
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.lineStrong,
    },
    stepIcon: {
      width: theme.sizes.rowIcon,
      height: theme.sizes.rowIcon,
      borderRadius: theme.radii.sm,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.fieldBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepCopy: {
      flex: 1,
    },
  });
