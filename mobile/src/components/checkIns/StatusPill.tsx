import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import type { CheckInStatus } from '@/components/checkIns/model';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** Small pill naming a check-in's outcome: sent, reviewed or missed. */
export function StatusPill({ status }: { status: CheckInStatus }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { colors } = theme;

  const look = {
    sent: { pill: styles.sent, color: colors.ink2 },
    reviewed: { pill: styles.reviewed, color: colors.success },
    missed: { pill: styles.missed, color: colors.muted },
  }[status];

  return (
    <View style={[styles.pill, look.pill]}>
      <Text variant="chipSmall" style={{ color: look.color }}>
        {t(`checkInHistory.status.${status}`)}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    pill: {
      paddingVertical: theme.spacing.hair,
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: 'transparent',
    },
    sent: {
      backgroundColor: theme.colors.tabSelected,
    },
    reviewed: {
      backgroundColor: theme.colors.successSoft,
    },
    missed: {
      borderColor: theme.colors.lineStrong,
    },
  });
