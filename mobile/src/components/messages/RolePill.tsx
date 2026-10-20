import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { roleLine, sortedRoles } from './format';

type RolePillProps = {
  roles: string[] | undefined;
};

/** Small role pill for a list row: orange when the coach trains, green for a nutritionist only. */
export function RolePill({ roles }: RolePillProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const sorted = sortedRoles(roles);
  if (sorted.length === 0) return null;

  const training = sorted.includes('Trainer');
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: training ? theme.colors.trainingSoft : theme.colors.nutritionSoft },
      ]}
    >
      <Text
        variant="captionStrong"
        style={{ color: training ? theme.colors.trainingInk : theme.colors.nutritionInk }}
      >
        {roleLine(t, roles)}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    pill: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs / 2,
      borderRadius: theme.radii.pill,
    },
  });
