import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import { tabBarCollapseMotion } from '@/theme/motion';

import { Text } from './Text';

export type GlassTabBarTab = {
  key: string;
  label: string;
  /** Renders the icon in the colour the tab is currently drawn with. */
  icon: (color: string) => ReactNode;
  active: boolean;
  onPress: () => void;
  /** Count shown on the icon; hidden at zero or when omitted. */
  badge?: number;
};

type GlassTabBarProps = {
  tabs: GlassTabBarTab[];
  /** Shrinks the bar to a round pill that shows only the active tab's icon. */
  collapsed?: boolean;
  /** Tapping the pill; expands the bar. */
  onExpand?: () => void;
  /** Accessibility label of the pill. */
  expandLabel?: string;
};

export function GlassTabBar({
  tabs,
  collapsed = false,
  onExpand,
  expandLabel,
}: GlassTabBarProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const tint = theme.scheme === 'dark' ? 'systemThinMaterialDark' : 'systemThinMaterialLight';
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(collapsed ? 1 : 0);
  const fullWidth = windowWidth - 2 * theme.spacing.xxl;
  const pillWidth = theme.sizes.tabPill;
  const activeTab = tabs.find((tab) => tab.active);

  useEffect(() => {
    const target = collapsed ? 1 : 0;
    progress.set(
      reduceMotion ? target : withTiming(target, { duration: tabBarCollapseMotion.duration }),
    );
  }, [collapsed, reduceMotion, progress]);

  const widthStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.get(), [0, 1], [fullWidth, pillWidth]),
  }));
  const barLayerStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));
  const pillLayerStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));

  return (
    <Animated.View
      accessibilityRole={collapsed ? undefined : 'tablist'}
      pointerEvents="box-none"
      style={[styles.shadow, widthStyle]}
    >
      <BlurView intensity={theme.glass.bar.intensity} tint={tint} style={styles.blur}>
        <View style={styles.fill}>
          <Animated.View
            pointerEvents={collapsed ? 'none' : 'auto'}
            importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
            accessibilityElementsHidden={collapsed}
            style={[styles.barLayer, { width: fullWidth - 2 * theme.sizes.border }, barLayerStyle]}
          >
            {tabs.map((tab) => {
              const color = tab.active ? theme.colors.accent : theme.colors.muted;
              return (
                <Pressable
                  key={tab.key}
                  accessibilityRole="tab"
                  accessibilityLabel={tab.badge ? `${tab.label}, ${tab.badge}` : tab.label}
                  accessibilityState={{ selected: tab.active }}
                  onPress={tab.onPress}
                  style={[styles.item, tab.active && styles.itemActive]}
                >
                  <View style={styles.icon}>
                    {tab.icon(color)}
                    {tab.badge ? (
                      <View style={styles.badge}>
                        <Text variant="micro" style={{ color: theme.colors.onAccent }}>
                          {tab.badge > 99 ? '99+' : String(tab.badge)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text variant={tab.active ? 'micro' : 'microMedium'} style={{ color }}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </Animated.View>
          <Animated.View
            pointerEvents={collapsed ? 'auto' : 'none'}
            style={[styles.pillLayer, pillLayerStyle]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={expandLabel}
              accessibilityElementsHidden={!collapsed}
              importantForAccessibility={collapsed ? 'auto' : 'no-hide-descendants'}
              onPress={onExpand}
              style={styles.pillPress}
            >
              {activeTab ? activeTab.icon(theme.colors.accent) : null}
            </Pressable>
          </Animated.View>
        </View>
      </BlurView>
    </Animated.View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    shadow: {
      position: 'absolute',
      left: theme.spacing.xxl,
      bottom: theme.sizes.tabBarBottom,
      height: theme.sizes.tabBar,
      borderRadius: theme.radii.pill,
      boxShadow: theme.shadows.glass,
    },
    blur: {
      flex: 1,
      overflow: 'hidden',
      borderRadius: theme.radii.pill,
    },
    fill: {
      flex: 1,
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.glassBorder,
      backgroundColor: theme.colors.glassFill,
    },
    barLayer: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.sizes.tabBarPadding,
    },
    pillLayer: StyleSheet.absoluteFill,
    pillPress: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    item: {
      flex: 1,
      height: theme.sizes.tabItem,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.sizes.tabItemGap,
      borderRadius: theme.radii.xxl,
    },
    itemActive: {
      backgroundColor: theme.colors.tabSelected,
    },
    icon: {
      width: theme.sizes.tabIcon,
      height: theme.sizes.tabIcon,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      top: -theme.spacing.xxs,
      left: theme.sizes.tabIcon / 2,
      minWidth: theme.sizes.tabBadge,
      height: theme.sizes.tabBadge,
      paddingHorizontal: theme.spacing.xxs,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.accent,
    },
  });
