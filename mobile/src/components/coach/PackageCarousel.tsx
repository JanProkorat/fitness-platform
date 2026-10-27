import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PublicProfilePackageDto } from '@/api/generated';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { PackageCard } from './PackageCard';

type PackageCarouselProps = {
  packages: readonly PublicProfilePackageDto[];
  /** False while payments are hidden: prices and period units are left out. */
  showPrices: boolean;
};

/** The coach's packages as full-width cards you swipe through, with page dots beside the section label. */
export function PackageCarousel({ packages, showPrices }: PackageCarouselProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { width: screenWidth } = useWindowDimensions();
  const [page, setPage] = useState(0);

  if (packages.length === 0) return null;

  const cardWidth = screenWidth - theme.spacing.xxl * 2;
  const interval = cardWidth + theme.spacing.md;

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / interval);
    setPage(Math.min(Math.max(next, 0), packages.length - 1));
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text variant="overline" color="muted" style={styles.overline}>
          {t('coachProfile.packages').toUpperCase()}
        </Text>
        {packages.length > 1 ? (
          <View
            style={styles.dots}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {packages.map((pack, index) => (
              <View
                key={`${pack.name ?? ''}-${index}`}
                style={[styles.dot, index === page && styles.dotActive]}
              />
            ))}
          </View>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={interval}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        scrollEventThrottle={16}
        onScroll={onScroll}
        style={styles.scroller}
        contentContainerStyle={styles.cards}
        accessibilityLabel={t('coachProfile.packages')}
      >
        {packages.map((pack, index) => (
          <PackageCard
            key={`${pack.name ?? ''}-${index}`}
            pack={pack}
            width={cardWidth}
            showPrices={showPrices}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    section: {
      gap: theme.spacing.xs,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    overline: {
      paddingHorizontal: theme.spacing.xxs,
      letterSpacing: theme.typography.overline.letterSpacing,
    },
    dots: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.snug,
    },
    dot: {
      width: theme.sizes.pageDot,
      height: theme.sizes.pageDot,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.lineStrong,
    },
    dotActive: {
      width: theme.sizes.pageDotActive,
      backgroundColor: theme.colors.ink,
    },
    scroller: {
      marginHorizontal: -theme.spacing.xxl,
    },
    cards: {
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.xxl,
      paddingTop: theme.spacing.xxs,
      paddingBottom: theme.spacing.xs,
    },
  });
