import { useEffect, useRef } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { Type } from '@/constants/typography';
import { useAuthStore } from '@/stores/auth';
import { connect, disconnect, onEvent } from '@/api/signalr';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import api from '../../src/api/client';

const TABS = [
  { name: 'index', label: 'Today', icon: 'home' as const, iconFocused: 'home' as const },
  { name: 'messages', label: 'Messages', icon: 'chatbubble-outline' as const, iconFocused: 'chatbubble' as const },
  { name: 'discover', label: 'Coaches', icon: 'search-outline' as const, iconFocused: 'search' as const },
  { name: 'plans', label: 'Plans', icon: 'calendar-outline' as const, iconFocused: 'calendar' as const },
  { name: 'profile', label: 'Profile', icon: 'person-outline' as const, iconFocused: 'person' as const },
] as const;

interface NotificationPayload {
  type?: 'invitation' | 'new_plan' | 'message' | 'questionnaire'
  planId?: string
  threadId?: string
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  } as Notifications.NotificationBehavior),
});

async function registerPushToken() {
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return
  // Remote push tokens only work on physical devices
  if (!Device.isDevice) return
  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data
    await api.post('/client/push-token', { token, platform: Platform.OS })
  } catch {
    // Simulator — token registration fails, but local notifications still work
  }
}

export default function ClientTabLayout() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const queryClient = useQueryClient();
  const registeredRef = useRef(false);
  const unreadMessages = useUnreadCount();

  // Register push token once
  useEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;
    registerPushToken();
  }, []);

  // Foreground: refresh queries when push notification arrives (system banner shows automatically)
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
    });
    return () => sub.remove();
  }, [queryClient]);

  // SignalR: connect and listen for real-time events
  useEffect(() => {
    connect().catch((err) => {
      console.warn('[SignalR] Initial connection failed:', err);
    });

    // Schedule a local notification so the native banner appears instantly
    // (remote push may be delayed or unavailable on simulator)
    const localNotify = (title: string, body: string) => {
      Notifications.scheduleNotificationAsync({
        content: { title, body, sound: 'default' },
        trigger: null, // immediate
      });
    };

    const unsubs = [
      onEvent('clientRequestAccepted', () => {
        localNotify('Invitation accepted', 'Your invitation was accepted!');
        queryClient.invalidateQueries({ queryKey: ['my-requests'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['collaborations'] });
        useAuthStore.getState().refreshProfile();
      }),
      onEvent('clientRequestRejected', () => {
        localNotify('Invitation declined', 'Your invitation was declined.');
        queryClient.invalidateQueries({ queryKey: ['my-requests'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }),
      onEvent('invitationReceived', () => {
        localNotify('New invitation', 'You received a new invitation.');
        queryClient.invalidateQueries({ queryKey: ['client-invite'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }),
      onEvent('questionnaireAssigned', () => {
        localNotify('Questionnaire assigned', 'You have a new questionnaire to fill.');
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        useAuthStore.getState().refreshProfile();
      }),
      onEvent('newMessage', (raw: unknown) => {
        const payload = raw as { conversationId?: string; senderName?: string };
        const currentPath = pathnameRef.current;
        const viewingThisChat = payload.conversationId && currentPath.includes(`/messages/${payload.conversationId}`);
        if (!viewingThisChat) {
          localNotify('New message', payload.senderName ? `${payload.senderName} sent you a message` : 'You have a new message');
        }
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        if (payload.conversationId) {
          queryClient.invalidateQueries({ queryKey: ['messages', payload.conversationId] });
        }
      }),
      onEvent('typing', (raw: unknown) => {
        const data = raw as { conversationId?: string } | undefined;
        if (data?.conversationId) {
          queryClient.setQueryData(['typing', data.conversationId], true);
          setTimeout(() => {
            queryClient.setQueryData(['typing', data.conversationId], false);
          }, 3000);
        }
      }),
      onEvent('userPresence', () => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
      disconnect().catch(() => {});
    };
  }, [queryClient]);

  // Background/tap: deep link on notification tap
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotificationPayload;
      switch (data.type) {
        case 'invitation':
          router.push('/(client)');
          break;
        case 'new_plan':
          if (data.planId) router.push(`/(client)/plans/${data.planId}` as never);
          break;
        case 'message':
          if (data.threadId) router.push(`/(client)/messages/${data.threadId}` as never);
          break;
        case 'questionnaire':
          router.push('/(client)/questionnaire' as never);
          break;
      }
    });
    return () => sub.remove();
  }, [router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.sep2,
          height: 50 + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: 'transparent',
          elevation: 0,
        },
        tabBarBackground: () => (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg + 'F2' }]} />
        ),
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.label3,
        tabBarLabelStyle: {
          ...Type.caption2,
          fontWeight: '500',
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? tab.iconFocused : tab.icon}
                size={24}
                color={color}
              />
            ),
            ...(tab.name === 'messages' && unreadMessages > 0
              ? {
                  tabBarBadge: unreadMessages,
                  tabBarBadgeStyle: { backgroundColor: colors.gold, color: '#ffffff', fontSize: 11 },
                }
              : {}),
          }}
        />
      ))}
      {/* Hide old routes and sub-routes from tab bar */}
      <Tabs.Screen name="training/index" options={{ href: null }} />
      <Tabs.Screen name="training/session/[id]" options={{ href: null }} />
      <Tabs.Screen name="training/log/[id]" options={{ href: null }} />
      <Tabs.Screen name="training/history" options={{ href: null }} />
      <Tabs.Screen name="training/progress" options={{ href: null }} />
      <Tabs.Screen name="nutrition/index" options={{ href: null }} />
      <Tabs.Screen name="nutrition/[mealId]" options={{ href: null }} />
      <Tabs.Screen name="nutrition/shopping" options={{ href: null }} />
      <Tabs.Screen name="nutrition/week-overview" options={{ href: null }} />
      <Tabs.Screen name="measurements/index" options={{ href: null }} />
      <Tabs.Screen name="measurements/new" options={{ href: null }} />
      <Tabs.Screen name="plans/[planId]" options={{ href: null }} />
      <Tabs.Screen name="messages/[threadId]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
    </Tabs>
  );
}
