import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { AvatarFailure } from '@/api/avatar';
import { CoachAvatar } from '@/components/coach/CoachAvatar';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type AvatarEditorProps = {
  firstName?: string;
  lastName?: string;
  avatarBlobUrl?: string;
  /** A photo action is running. */
  busy: boolean;
  failure: AvatarFailure | null;
  onChange: () => void;
  onRemove: () => void;
};

/** The profile photo with its Change photo and Remove actions; they apply immediately. */
export function AvatarEditor({
  firstName,
  lastName,
  avatarBlobUrl,
  busy,
  failure,
  onChange,
  onRemove,
}: AvatarEditorProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.root}>
      <View style={styles.avatar}>
        <CoachAvatar
          coach={{ firstName, lastName, avatarBlobUrl }}
          size={theme.sizes.editAvatar}
          initialsVariant="profileInitials"
        />
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={theme.colors.onAvatar} />
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('editProfile.photo.change')}
          disabled={busy}
          onPress={onChange}
          style={styles.badge}
        >
          <SymbolView name="camera" tintColor={theme.colors.onPrimary} size={theme.sizes.stepGlyph} />
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onChange}
          style={[styles.pill, styles.pillOutline]}
        >
          <Text variant="link">{t('editProfile.photo.change')}</Text>
        </Pressable>
        {avatarBlobUrl ? (
          <Pressable accessibilityRole="button" disabled={busy} onPress={onRemove} style={styles.pill}>
            <Text variant="link" color="error">
              {t('editProfile.photo.remove')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {failure ? (
        <Text variant="label" color="error" accessibilityRole="alert" style={styles.centered}>
          {t(`editProfile.photo.errors.${failure}`)}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    avatar: {
      width: theme.sizes.editAvatar,
      height: theme.sizes.editAvatar,
    },
    busy: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.avatar,
      opacity: 0.7,
    },
    badge: {
      position: 'absolute',
      right: -theme.spacing.hair,
      bottom: -theme.spacing.hair,
      width: theme.sizes.editAvatarBadge,
      height: theme.sizes.editAvatarBadge,
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.editAvatarBadgeBorder,
      borderColor: theme.colors.ground,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    actions: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    pill: {
      height: theme.sizes.buttonSmall + theme.spacing.hair,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillOutline: {
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
    },
    centered: {
      textAlign: 'center',
    },
  });
