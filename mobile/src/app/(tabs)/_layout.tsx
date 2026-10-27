import { useEffect } from 'react';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { Tabs } from 'expo-router/js-tabs';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { GlassTabBar } from '@/components/GlassTabBar';
import { TabBarCollapseProvider, useTabBarCollapse } from '@/components/TabBarCollapse';
import { useUnreadMessageCount } from '@/hooks/useConversations';
import { useTheme } from '@/theme';

type TabKey = 'index' | 'training' | 'nutrition' | 'messages';

const TAB_SYMBOLS: Record<TabKey, SFSymbol> = {
  index: 'house',
  training: 'figure.strengthtraining.traditional',
  nutrition: 'leaf',
  messages: 'bubble.left',
};

const TAB_LABEL_KEYS: Record<TabKey, string> = {
  index: 'tabs.today',
  training: 'tabs.training',
  nutrition: 'tabs.nutrition',
  messages: 'tabs.messages',
};

const noop = () => {};

const isTabKey = (name: string): name is TabKey => name in TAB_SYMBOLS;

function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const unreadMessages = useUnreadMessageCount();
  const collapse = useTabBarCollapse();
  const collapsed = collapse?.collapsed ?? false;
  const setCollapsed = collapse?.setCollapsed ?? noop;

  const tabs = state.routes.flatMap((route, index) => {
    if (!isTabKey(route.name)) {
      return [];
    }
    const key = route.name;
    const active = state.index === index;
    return [
      {
        key: route.key,
        label: t(TAB_LABEL_KEYS[key]),
        active,
        badge: key === 'messages' ? unreadMessages : undefined,
        onPress: () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!active && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        },
        icon: (color: string) => (
          <SymbolView name={TAB_SYMBOLS[key]} tintColor={color} size={theme.sizes.tabIcon} />
        ),
      },
    ];
  });

  const activeLabel = tabs.find((tab) => tab.active)?.label ?? '';

  // A newly selected tab never opens with the bar collapsed.
  useEffect(() => {
    setCollapsed(false);
  }, [state.index, setCollapsed]);

  return (
    <GlassTabBar
      tabs={tabs}
      collapsed={collapsed}
      onExpand={() => setCollapsed(false)}
      expandLabel={t('tabs.showTabs', { tab: activeLabel })}
    />
  );
}

export default function TabsLayout() {
  return (
    <TabBarCollapseProvider>
      <TabsNavigator />
    </TabBarCollapseProvider>
  );
}

function TabsNavigator() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
      tabBar={(props) => <AppTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="training" />
      <Tabs.Screen name="nutrition" />
      <Tabs.Screen name="messages" />
    </Tabs>
  );
}
