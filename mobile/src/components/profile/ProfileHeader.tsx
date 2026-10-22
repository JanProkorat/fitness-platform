import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CoachAvatar } from '@/components/coach/CoachAvatar';
import { ImageViewer } from '@/components/photos/ImageViewer';
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
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [viewerOpen, setViewerOpen] = useState(false);

  const avatar = (
    <CoachAvatar
      coach={{ firstName, lastName, avatarBlobUrl }}
      size={theme.sizes.profileAvatar}
      initialsVariant="profileInitials"
    />
  );

  return (
    <View style={styles.root}>
      {avatarBlobUrl ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('profile.viewPhoto')}
            onPress={() => setViewerOpen(true)}
          >
            {avatar}
          </Pressable>
          <ImageViewer
            uri={viewerOpen ? avatarBlobUrl : null}
            imageLabel={t('profile.photoLabel')}
            closeLabel={t('photos.viewer.close')}
            onClose={() => setViewerOpen(false)}
          />
        </>
      ) : (
        avatar
      )}
      {name ? (
        <Text variant="profileName" accessibilityRole="header" style={styles.centered}>
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
