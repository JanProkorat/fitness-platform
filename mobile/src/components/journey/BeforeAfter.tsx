import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';

import type { ClientPlanSummaryPhoto } from '@/api/generated';
import { Text } from '@/components/Text';
import { dayLabel, parseTime } from '@/components/journey/format';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type BeforeAfterProps = {
  first: ClientPlanSummaryPhoto;
  last: ClientPlanSummaryPhoto;
};

function PhotoTile({ photo, caption }: { photo: ClientPlanSummaryPhoto; caption: string }) {
  const { i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const takenAt = parseTime(photo.takenAt);
  return (
    <View style={styles.tile}>
      <Image
        source={photo.displayUrl ? { uri: photo.displayUrl } : undefined}
        contentFit="cover"
        style={styles.photo}
        accessibilityIgnoresInvertColors
        accessibilityLabel={caption}
      />
      <View style={styles.caption}>
        <Text variant="bodyStrong">{caption}</Text>
        {takenAt !== null ? (
          <Text variant="bodySmall" color="muted">
            {dayLabel(i18n.language, takenAt)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** The first and last progress photo of the plan window side by side; a lone photo is shown once. */
export function BeforeAfter({ first, last }: BeforeAfterProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const single = first.id !== undefined && first.id === last.id;

  return (
    <View style={styles.card}>
      <Text variant="subtitle" accessibilityRole="header">
        {t('journey.summary.beforeAfter')}
      </Text>
      <View style={styles.pair}>
        {single ? (
          <PhotoTile photo={first} caption={t('journey.summary.onlyPhoto')} />
        ) : (
          <>
            <PhotoTile photo={first} caption={t('journey.summary.start')} />
            <PhotoTile photo={last} caption={t('journey.summary.end')} />
          </>
        )}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      gap: theme.spacing.lg,
      padding: theme.spacing.xl,
      borderRadius: theme.radii.xxl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    pair: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    tile: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.sm,
    },
    photo: {
      aspectRatio: 1,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.field,
    },
    caption: {
      gap: theme.spacing.hair,
    },
  });
