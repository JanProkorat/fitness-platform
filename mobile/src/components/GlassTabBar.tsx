import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { Text } from './Text';

export type GlassTabBarTab = {
  key: string;
  label: string;
  /** Renders the icon in the colour the tab is currently drawn with. */
  icon: (color: string) => ReactNode;
  active: boolean;
  onPress: () => void;
};

type GlassTabBarProps = {
  tabs: GlassTabBarTab[];
};

export function GlassTabBar({ tabs }: GlassTabBarProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const tint = theme.scheme === 'dark' ? 'systemThinMaterialDark' : 'systemThinMaterialLight';

  return (
    <View
      accessibilityRole="tablist"
      pointerEvents="box-none"
      style={styles.shadow}
    >
      <BlurView intensity={theme.glass.bar.intensity} tint={tint} style={styles.blur}>
        <View style={styles.fill}>
          {tabs.map((tab) => {
            const color = tab.active ? theme.colors.accent : theme.colors.muted;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: tab.active }}
                onPress={tab.onPress}
                style={[styles.item, tab.active && styles.itemActive]}
              >
                <View style={styles.icon}>{tab.icon(color)}</View>
                <Text variant={tab.active ? 'micro' : 'microMedium'} style={{ color }}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    shadow: {
      position: 'absolute',
      left: theme.spacing.xxl,
      right: theme.spacing.xxl,
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
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.sizes.tabBarPadding,
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.glassBorder,
      backgroundColor: theme.colors.glassFill,
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
  });
