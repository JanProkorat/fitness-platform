import { StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Colors, Theme } from '@/theme';

type ScreenHeaderProps = {
  title: string;
  backLabel: string;
  onBack: () => void;
  subtitle?: string;
  subtitleColor?: keyof Colors;
};

/** One header row: back button left, centred one-line title with an optional subtitle under it. */
export function ScreenHeader({
  title,
  backLabel,
  onBack,
  subtitle,
  subtitleColor = 'muted',
}: ScreenHeaderProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.row}>
      <View style={styles.slot}>
        <BackButton label={backLabel} onPress={onBack} />
      </View>
      <View style={styles.titles}>
        <Text
          variant="headerTitle"
          accessibilityRole="header"
          numberOfLines={1}
          style={styles.centered}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            variant="headerSubtitle"
            color={subtitleColor}
            numberOfLines={1}
            style={styles.centered}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.slot} />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: theme.spacing.safeAreaGap,
    },
    slot: {
      width: theme.sizes.headerSlot,
      alignItems: 'flex-start',
    },
    titles: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing.hair,
    },
    centered: {
      textAlign: 'center',
    },
  });
