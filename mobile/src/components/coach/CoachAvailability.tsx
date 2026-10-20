import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type CoachAvailabilityProps = {
  acceptsNewClients: boolean;
};

/** "Taking clients" or "Waitlist", with a status dot. */
export function CoachAvailability({ acceptsNewClients }: CoachAvailabilityProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const color = acceptsNewClients ? theme.colors.success : theme.colors.muted;

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text variant="label" style={{ color }}>
        {acceptsNewClients ? t('coachSearch.takingClients') : t('coachSearch.waitlist')}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    dot: {
      width: theme.sizes.statusDot,
      height: theme.sizes.statusDot,
      borderRadius: theme.radii.pill,
    },
  });
