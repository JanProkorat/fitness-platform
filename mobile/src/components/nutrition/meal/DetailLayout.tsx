import type { ReactNode, RefObject } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { BackButton } from '@/components/BackButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type DetailLayoutProps = {
  heroHeight: number;
  imageUri?: string;
  backLabel: string;
  onBack: () => void;
  /** Glass controls at the end of the top bar. */
  actions?: ReactNode;
  /** Floating buttons at the bottom of the screen. */
  footer?: ReactNode;
  scrollRef?: RefObject<ScrollView | null>;
  children: ReactNode;
};

/** Image hero under floating glass controls, with the content on a rounded sheet that overlaps it. */
export function DetailLayout({
  heroHeight,
  imageUri,
  backLabel,
  onBack,
  actions,
  footer,
  scrollRef,
  children,
}: DetailLayoutProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingBottom: footer ? theme.sizes.heroActionClearance + insets.bottom : insets.bottom }}
      >
        <View style={[styles.hero, { height: heroHeight }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} contentFit="cover" style={styles.image} accessibilityIgnoresInvertColors />
          ) : (
            <SymbolView name="fork.knife" tintColor={theme.colors.nutritionInk} size={theme.sizes.heroGlyph} />
          )}
        </View>
        <View style={styles.sheet}>
          <OfflineBanner />
          {children}
        </View>
      </ScrollView>

      <View style={[styles.topBar, { top: insets.top + theme.spacing.xs }]}>
        <BackButton label={backLabel} onPress={onBack} />
        <View style={styles.actions}>{actions}</View>
      </View>

      {footer ? (
        <View
          pointerEvents="none"
          style={[styles.fade, { height: theme.sizes.heroActionClearance + insets.bottom }]}
        >
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="detailFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.colors.ground} stopOpacity={0} />
                <Stop offset="0.55" stopColor={theme.colors.ground} stopOpacity={1} />
                <Stop offset="1" stopColor={theme.colors.ground} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#detailFade)" />
          </Svg>
        </View>
      ) : null}

      {footer ? <View style={[styles.footer,{ bottom: insets.bottom + theme.spacing.xxl }]}>{footer}</View> : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.ground,
    },
    hero: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.nutritionSoft,
    },
    image: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    sheet: {
      marginTop: -theme.sizes.heroOverlap,
      gap: theme.spacing.lg,
      paddingTop: theme.spacing.cardInset,
      paddingHorizontal: theme.spacing.xl,
      borderTopLeftRadius: theme.radii.xxl,
      borderTopRightRadius: theme.radii.xxl,
      backgroundColor: theme.colors.ground,
    },
    topBar: {
      position: 'absolute',
      left: theme.spacing.xl,
      right: theme.spacing.xl,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    actions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    fade: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
    },
    footer: {
      position: 'absolute',
      left: theme.spacing.xxl,
      right: theme.spacing.xxl,
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
  });
