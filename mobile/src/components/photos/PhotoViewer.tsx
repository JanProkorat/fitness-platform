import { Alert, Modal, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ProgressPhoto } from '@/api/photos';
import { GlassButton } from '@/components/profile/GlassButton';
import { Text } from '@/components/Text';
import { photoDateLabel } from '@/components/photos/format';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type PhotoViewerProps = {
  /** The photo to show; the viewer is closed while this is null. */
  photo: ProgressPhoto | null;
  /** Only photos the signed-in user uploaded can be deleted. */
  canDelete: boolean;
  deleting: boolean;
  onClose: () => void;
  onDelete: (photo: ProgressPhoto) => void;
};

/** Full-screen view of one photo, with a confirmed delete for the user's own photos. */
export function PhotoViewer({ photo, canDelete, deleting, onClose, onDelete }: PhotoViewerProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();

  const confirmDelete = () => {
    if (!photo) return;
    Alert.alert(t('photos.viewer.deleteTitle'), t('photos.viewer.deleteBody'), [
      { text: t('photos.cancel'), style: 'cancel' },
      { text: t('photos.viewer.deleteConfirm'), style: 'destructive', onPress: () => onDelete(photo) },
    ]);
  };

  return (
    <Modal visible={photo !== null} animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        {photo ? (
          <Image
            source={{ uri: photo.displayUrl }}
            style={styles.image}
            contentFit="contain"
            accessibilityLabel={t('photos.photoLabel', { date: photoDateLabel(i18n.language, photo.takenAt) })}
          />
        ) : null}
        <View style={[styles.topBar, { top: insets.top + theme.spacing.xs }]}>
          <GlassButton label={t('photos.viewer.close')} onPress={onClose}>
            <SymbolView name="xmark" tintColor={theme.colors.ink} size={theme.sizes.backIcon} />
          </GlassButton>
          {canDelete ? (
            <GlassButton label={t('photos.viewer.delete')} onPress={deleting ? undefined : confirmDelete}>
              <SymbolView name="trash" tintColor={theme.colors.error} size={theme.sizes.backIcon} />
            </GlassButton>
          ) : null}
        </View>
        {photo ? (
          <View style={[styles.caption, { bottom: insets.bottom + theme.spacing.xl }]}>
            <Text variant="label" color="muted">
              {photoDateLabel(i18n.language, photo.takenAt)}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.ground,
    },
    image: {
      flex: 1,
    },
    topBar: {
      position: 'absolute',
      left: theme.spacing.xl,
      right: theme.spacing.xl,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    caption: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
    },
  });
