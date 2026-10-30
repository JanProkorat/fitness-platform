import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { selectIsOffline, useConnectivityStore } from '@/stores/connectivity';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** "14:05" for data from today, "27 Oct, 14:05" for older data; null when the value is not a real time. */
export function formatUpdatedAt(at: number | null, language: string, now: number = Date.now()): string | null {
  if (at === null || !Number.isFinite(at) || at <= 0) return null;
  const date = new Date(at);
  const clock = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const;
  try {
    const time = date.toLocaleTimeString(language, clock);
    if (date.toDateString() === new Date(now).toDateString()) return time;
    return `${date.toLocaleDateString(language, { day: 'numeric', month: 'short' })}, ${time}`;
  } catch {
    return date.toLocaleString();
  }
}

type OfflineBannerProps = {
  /** Leave out the "changes sync when you're back online" sentence, as the shorter boards do. */
  short?: boolean;
};

/** In-flow status card shown under a screen's title while the API is unreachable and the screen runs on saved data. */
export function OfflineBanner({ short = false }: OfflineBannerProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isOffline = useConnectivityStore(selectIsOffline);
  const lastSuccessAt = useConnectivityStore((state) => state.lastSuccessAt);

  if (!isOffline) return null;

  const styles = makeStyles(theme);
  const time = formatUpdatedAt(lastSuccessAt, i18n.language);
  const detail =
    time === null
      ? short
        ? ''
        : t('offline.detail')
      : t(short ? 'offline.detailShort' : 'offline.detailWithTime', { time });

  return (
    <View accessible accessibilityRole="alert" style={styles.card}>
      <SymbolView
        name="icloud.slash"
        weight="medium"
        tintColor={theme.colors.ink2}
        size={theme.sizes.bannerGlyph}
      />
      <Text variant="label" color="ink2" style={styles.text}>
        <Text variant="labelStrong" color="ink">
          {t('offline.banner')}
        </Text>
        {detail}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.tight,
      alignSelf: 'stretch',
      backgroundColor: theme.colors.tabSelected,
      borderRadius: theme.radii.xl,
      paddingVertical: theme.spacing.tight,
      paddingHorizontal: theme.spacing.lg,
    },
    text: {
      flex: 1,
    },
  });
