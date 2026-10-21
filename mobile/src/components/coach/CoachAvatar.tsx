import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { coachInitials } from '@/api/professionals';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme, TypographyRole } from '@/theme';

type CoachAvatarProps = {
  coach: { firstName?: string; lastName?: string; avatarBlobUrl?: string };
  size: number;
  /** Type role of the initials shown when the coach has no photo. */
  initialsVariant?: TypographyRole;
};

/** The coach's photo, or their initials on a dark disc when there is none. */
export function CoachAvatar({ coach, size, initialsVariant = 'subtitle' }: CoachAvatarProps) {
  const theme = useTheme();
  const styles = makeStyles(theme, size);

  return (
    <View style={styles.disc} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {coach.avatarBlobUrl ? (
        <Image source={{ uri: coach.avatarBlobUrl }} style={styles.image} contentFit="cover" />
      ) : (
        <Text variant={initialsVariant} style={styles.initials}>
          {coachInitials(coach)}
        </Text>
      )}
    </View>
  );
}

const makeStyles = (theme: Theme, size: number) =>
  StyleSheet.create({
    disc: {
      width: size,
      height: size,
      borderRadius: theme.radii.pill,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.avatar,
    },
    image: {
      width: size,
      height: size,
    },
    initials: {
      color: theme.colors.onAvatar,
    },
  });
