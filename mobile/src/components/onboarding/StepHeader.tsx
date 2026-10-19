import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BackButton } from '@/components/BackButton';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type StepHeaderProps = {
  step: number;
  total: number;
  /** Omit on the first step: the slot stays empty so the layout does not shift. */
  onBack?: () => void;
};

/** Back button, "n of N" and a thin progress bar. */
export function StepHeader({ step, total, onBack }: StepHeaderProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {onBack ? <BackButton label={t('onboarding.back')} onPress={onBack} /> : null}
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('onboarding.stepOf', { step, total })}
        accessibilityValue={{ min: 0, max: total, now: step }}
        style={styles.center}
      >
        <Text variant="label" color="muted">
          {t('onboarding.stepOf', { step, total })}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(step / total) * 100}%` }]} />
        </View>
      </View>
      <View style={styles.side} />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: theme.sizes.backButton,
    },
    side: {
      width: theme.sizes.backButton,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.xxxl,
    },
    track: {
      alignSelf: 'stretch',
      height: theme.sizes.progressBar,
      borderRadius: theme.radii.pill,
      overflow: 'hidden',
      backgroundColor: theme.colors.lineStrong,
    },
    fill: {
      height: '100%',
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.primary,
    },
  });
