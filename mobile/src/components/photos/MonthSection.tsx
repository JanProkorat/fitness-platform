import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';

import type { PhotoMonth, ProgressPhoto } from '@/api/photos';
import { Text } from '@/components/Text';
import { monthLabel, photoDateLabel } from '@/components/photos/format';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const COLUMNS = 3;

type MonthSectionProps = {
  month: PhotoMonth;
  onOpen: (photo: ProgressPhoto) => void;
};

/** One month of photos: a heading with the count and a three-column thumbnail grid. */
export function MonthSection({ month, onOpen }: MonthSectionProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const language = i18n.language;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text variant="link" accessibilityRole="header">
          {monthLabel(language, month.yearMonth)}
        </Text>
        <Text variant="caption" color="muted">
          {t('photos.count', { count: month.photos.length })}
        </Text>
      </View>
      <View style={styles.grid}>
        {month.photos.map((photo) => (
          <View key={photo.id} style={styles.cell}>
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel={t('photos.photoLabel', { date: photoDateLabel(language, photo.takenAt) })}
              onPress={() => onOpen(photo)}
              style={styles.thumb}
            >
              <Image source={{ uri: photo.displayUrl }} style={styles.image} contentFit="cover" />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    section: {
      gap: theme.spacing.xs,
    },
    heading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.xxs,
    },
    // Negative margin cancels the cells' outer padding so the grid sits flush with the gutter.
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -theme.spacing.snug / 2,
    },
    cell: {
      width: `${100 / COLUMNS}%`,
      padding: theme.spacing.snug / 2,
    },
    thumb: {
      aspectRatio: 3 / 4,
      borderRadius: theme.radii.md,
      overflow: 'hidden',
      backgroundColor: theme.colors.field,
    },
    image: {
      flex: 1,
    },
  });
