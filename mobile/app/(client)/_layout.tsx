import { Tabs } from 'expo-router';
import { Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/Colors';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    index: '🏠',
    'training/index': '🏋️',
    'nutrition/index': '🍽️',
    'measurements/index': '📏',
  };
  return <Text style={styles.icon}>{icons[name] ?? '•'}</Text>;
}

export default function ClientTabLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.dark.surface,
          borderTopColor: Colors.dark.border,
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.dark.gold,
        tabBarInactiveTintColor: Colors.dark.text3,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.today'),
          tabBarIcon: ({ focused }) => <TabIcon name="index" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="training/index"
        options={{
          title: t('tabs.training'),
          tabBarIcon: ({ focused }) => <TabIcon name="training/index" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="nutrition/index"
        options={{
          title: t('tabs.nutrition'),
          tabBarIcon: ({ focused }) => <TabIcon name="nutrition/index" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="measurements/index"
        options={{
          title: t('tabs.progress'),
          tabBarIcon: ({ focused }) => <TabIcon name="measurements/index" focused={focused} />,
        }}
      />
      {/* Hide sub-routes from tabs */}
      <Tabs.Screen name="training/session/[id]" options={{ href: null }} />
      <Tabs.Screen name="training/log/[id]" options={{ href: null }} />
      <Tabs.Screen name="training/history" options={{ href: null }} />
      <Tabs.Screen name="training/progress" options={{ href: null }} />
      <Tabs.Screen name="nutrition/[mealId]" options={{ href: null }} />
      <Tabs.Screen name="nutrition/shopping" options={{ href: null }} />
      <Tabs.Screen name="nutrition/week-overview" options={{ href: null }} />
      <Tabs.Screen name="measurements/new" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 22,
  },
});
