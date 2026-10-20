import { StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { initials } from './format';

type InviteAvatarProps = {
  name: string | undefined;
};

/** Round initials avatar for an inviting coach; a bell stands in when there is no name. */
export function InviteAvatar({ name }: InviteAvatarProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const letters = initials(name);

  return (
    <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {letters ? (
        <Text variant="bodyStrong" style={{ color: theme.colors.onAvatar }}>
          {letters}
        </Text>
      ) : (
        <SymbolView name="bell" tintColor={theme.colors.onAvatar} size={theme.sizes.bellGlyph} />
      )}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    avatar: {
      width: theme.sizes.inviteAvatar,
      height: theme.sizes.inviteAvatar,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.avatar,
    },
  });
