import { getLocales } from 'expo-localization';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Text';
import { selectIsOffline, useConnectivityStore } from '@/stores/connectivity';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** Date and time in the device locale; empty when the value is not a real time. */
function formatUpdatedAt(at: number | null): string | null {
  if (at === null || !Number.isFinite(at) || at <= 0) return null;
  const date = new Date(at);
  const tag = getLocales()[0]?.languageTag;
  try {
    return date.toLocaleString(tag, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return date.toLocaleString();
  }
}

/** Floating notice shown while the API is unreachable and the screens run on saved data. */
export function OfflineBanner() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isOffline = useConnectivityStore(selectIsOffline);
  const lastSuccessAt = useConnectivityStore((state) => state.lastSuccessAt);

  if (!isOffline) return null;

  const styles = makeStyles(theme);
  const time = formatUpdatedAt(lastSuccessAt);

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top }]}
      accessibilityRole="alert"
    >
      <View style={styles.pill}>
        <Text variant="captionStrong" color="warning">
          {time === null ? t('offline.banner') : t('offline.bannerWithTime', { time })}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    pill: {
      backgroundColor: theme.colors.warningSoft,
      borderRadius: theme.radii.pill,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.xxs,
    },
  });
