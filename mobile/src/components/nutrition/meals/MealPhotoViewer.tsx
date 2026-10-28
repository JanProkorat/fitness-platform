import { StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { ImageViewer } from '@/components/photos/ImageViewer';
import { GlassButton } from '@/components/profile/GlassButton';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export type ViewerPhoto = { key: string; uri: string; note?: string; uploadedAt?: string };

type MealPhotoViewerProps = {
  /** Meal name shown above the pager. */
  title: string;
  photos: ViewerPhoto[];
  /** Index of the open photo; the viewer is closed while this is null. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

/** Full-screen meal photos with previous and next controls, built on the shared image viewer. */
export function MealPhotoViewer({ title, photos, index, onIndexChange, onClose }: MealPhotoViewerProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const photo = index === null ? undefined : photos[index];
  const count = photos.length;
  const position = index === null ? 0 : index;
  const time = photo?.uploadedAt
    ? new Date(photo.uploadedAt).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' })
    : null;
  const subtitle = [t('nutritionPlan.viewer.position', { index: position + 1, count }), time]
    .filter(Boolean)
    .join(' · ');

  return (
    <ImageViewer
      uri={photo?.uri ?? null}
      imageLabel={t('nutritionPlan.viewer.imageLabel', { meal: title, index: position + 1, count })}
      closeLabel={t('nutritionPlan.viewer.close')}
      onClose={onClose}
      actions={
        count > 1 ? (
          <View style={styles.pager}>
            <GlassButton
              label={t('nutritionPlan.viewer.previous')}
              onPress={position > 0 ? () => onIndexChange(position - 1) : undefined}
            >
              <SymbolView
                name="chevron.left"
                tintColor={position > 0 ? theme.colors.ink : theme.colors.muted}
                size={theme.sizes.backIcon}
              />
            </GlassButton>
            <GlassButton
              label={t('nutritionPlan.viewer.next')}
              onPress={position < count - 1 ? () => onIndexChange(position + 1) : undefined}
            >
              <SymbolView
                name="chevron.right"
                tintColor={position < count - 1 ? theme.colors.ink : theme.colors.muted}
                size={theme.sizes.backIcon}
              />
            </GlassButton>
          </View>
        ) : null
      }
      caption={
        <View style={styles.caption}>
          <Text variant="subtitle" accessibilityRole="header" style={styles.centered}>
            {title}
          </Text>
          <Text variant="label" color="muted" style={styles.centered}>
            {subtitle}
          </Text>
          {photo?.note ? (
            <Text variant="body" style={styles.centered}>
              {photo.note}
            </Text>
          ) : null}
          {count > 1 ? (
            <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {photos.map((entry, dotIndex) => (
                <View key={entry.key} style={[styles.dot, dotIndex === position && styles.dotActive]} />
              ))}
            </View>
          ) : null}
        </View>
      }
    />
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    pager: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    caption: {
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.xxl,
    },
    centered: {
      textAlign: 'center',
    },
    dots: {
      flexDirection: 'row',
      gap: theme.spacing.snug,
      paddingTop: theme.spacing.xs,
    },
    dot: {
      width: theme.sizes.viewerDot,
      height: theme.sizes.viewerDot,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.lineStrong,
    },
    dotActive: {
      backgroundColor: theme.colors.ink,
    },
  });
