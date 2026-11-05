import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/Text';
import { selectIsOffline, useConnectivityStore } from '@/stores/connectivity';
import { useTheme } from '@/theme';
import { offlineBannerMotion } from '@/theme/motion';
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

/**
 * In-flow status card shown under a screen's title while the API is unreachable and the screen runs on saved data.
 * It slides down from the top when the app goes offline and back up (then unmounts) when the connection returns; the
 * slot's height follows, so content below moves with it. With reduced motion it appears and disappears at once.
 */
export function OfflineBanner({ short = false }: OfflineBannerProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isOffline = useConnectivityStore(selectIsOffline);
  const lastSuccessAt = useConnectivityStore((state) => state.lastSuccessAt);

  const reduceMotion = useReducedMotion();
  // `exited` flips once the slide-up has finished; until then the card stays mounted. `progress`: 0 hidden, 1 shown.
  const [exited, setExited] = useState(!isOffline);
  if (isOffline && exited) setExited(false);
  const mounted = isOffline || (!exited && !reduceMotion);
  const progress = useSharedValue(isOffline ? 1 : 0);
  const cardHeight = useSharedValue(0);

  useEffect(() => {
    const timing = { duration: offlineBannerMotion.duration, easing: Easing.out(Easing.cubic) };
    if (isOffline) {
      progress.set(reduceMotion ? 1 : withTiming(1, timing));
    } else if (reduceMotion) {
      progress.set(0);
    } else {
      progress.set(
        withTiming(0, timing, (finished) => {
          if (finished) scheduleOnRN(setExited, true);
        }),
      );
    }
  }, [isOffline, reduceMotion, progress]);

  const slotStyle = useAnimatedStyle(() => ({ height: progress.get() * cardHeight.get() }));
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -(1 - progress.get()) * cardHeight.get() }],
  }));

  if (!mounted) return null;

  const styles = makeStyles(theme);
  const time = formatUpdatedAt(lastSuccessAt, i18n.language);
  const detail =
    time === null
      ? short
        ? ''
        : t('offline.detail')
      : t(short ? 'offline.detailShort' : 'offline.detailWithTime', { time });

  return (
    <Animated.View style={[styles.slot, slotStyle]}>
      <Animated.View
        accessible
        accessibilityRole="alert"
        onLayout={(event: LayoutChangeEvent) => cardHeight.set(event.nativeEvent.layout.height)}
        style={[styles.card, slideStyle]}
      >
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
      </Animated.View>
    </Animated.View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    // Clips the card while it slides; the card is absolute so its own height is measurable at any slot height.
    slot: {
      alignSelf: 'stretch',
      overflow: 'hidden',
    },
    card: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.tight,
      backgroundColor: theme.colors.tabSelected,
      borderRadius: theme.radii.xl,
      paddingVertical: theme.spacing.tight,
      paddingHorizontal: theme.spacing.lg,
    },
    text: {
      flex: 1,
    },
  });
