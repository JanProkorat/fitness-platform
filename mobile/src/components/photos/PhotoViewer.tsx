import { Alert } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { ProgressPhoto } from '@/api/photos';
import { GlassButton } from '@/components/profile/GlassButton';
import { Text } from '@/components/Text';
import { ImageViewer } from '@/components/photos/ImageViewer';
import { photoDateLabel } from '@/components/photos/format';
import { useTheme } from '@/theme';

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

  const confirmDelete = () => {
    if (!photo) return;
    Alert.alert(t('photos.viewer.deleteTitle'), t('photos.viewer.deleteBody'), [
      { text: t('photos.cancel'), style: 'cancel' },
      { text: t('photos.viewer.deleteConfirm'), style: 'destructive', onPress: () => onDelete(photo) },
    ]);
  };

  const dateLabel = photo ? photoDateLabel(i18n.language, photo.takenAt) : '';

  return (
    <ImageViewer
      uri={photo ? photo.displayUrl : null}
      imageLabel={t('photos.photoLabel', { date: dateLabel })}
      closeLabel={t('photos.viewer.close')}
      onClose={onClose}
      actions={
        canDelete ? (
          <GlassButton label={t('photos.viewer.delete')} onPress={deleting ? undefined : confirmDelete}>
            <SymbolView name="trash" tintColor={theme.colors.error} size={theme.sizes.backIcon} />
          </GlassButton>
        ) : null
      }
      caption={
        <Text variant="label" color="muted">
          {dateLabel}
        </Text>
      }
    />
  );
}
