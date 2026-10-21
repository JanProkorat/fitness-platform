import { StyleSheet, View } from 'react-native';

import { CoachAvatar } from '@/components/coach/CoachAvatar';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type ProfileHeaderProps = {
  firstName?: string;
  lastName?: string;
  avatarBlobUrl?: string;
  name: string;
  subtitle: string;
};

/** Avatar, name and the goal line at the top of the Profile screen. */
export function ProfileHeader({ firstName, lastName, avatarBlobUrl, name, subtitle }: ProfileHeaderProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.root}>
      <CoachAvatar
        coach={{ firstName, lastName, avatarBlobUrl }}
        size={theme.sizes.profileAvatar}
        initialsVariant="heading"
      />
      {name ? (
        <Text variant="title" accessibilityRole="header" style={styles.centered}>
          {name}
        </Text>
      ) : null}
      {subtitle ? (
        <Text variant="label" color="muted" style={styles.centered}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.xxs,
    },
    centered: {
      textAlign: 'center',
    },
  });
