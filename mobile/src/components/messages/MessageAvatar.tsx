import { StyleSheet, View } from 'react-native';

import { initials } from '@/components/invites/format';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type MessageAvatarProps = {
  name: string | undefined;
  size: number;
  /** Faded look for a coach the client no longer works with. */
  muted?: boolean;
};

/** Round initials avatar for a conversation partner. */
export function MessageAvatar({ name, size, muted = false }: MessageAvatarProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatar,
        { width: size, height: size },
        muted && { backgroundColor: theme.colors.field },
      ]}
    >
      <Text
        variant={size > theme.sizes.chatAvatar ? 'bodyStrong' : 'captionStrong'}
        style={{ color: muted ? theme.colors.muted : theme.colors.onAvatar }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    avatar: {
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.avatar,
    },
  });
