import { useEffect, useRef } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from '@/lib/notifications-shim';
import * as Device from 'expo-device';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { href } from '@/lib/navigation';
import { useTheme } from '@/hooks/useTheme';
import { Type } from '@/constants/typography';
import { useAuthStore } from '@/stores/auth';
import { connect, disconnect, onEvent } from '@/api/signalr';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useMessagesStore } from '@/stores/messagesStore';
import { Toast } from '@/lib/toast';
import api from '@/api/client';
import { useHydrationStore } from '@/stores/hydrationStore';
import { listReminderKeys, cancelReminder, scheduleDailyReminder } from '@/lib/reminderScheduler';

const TABS = [
  { name: 'index', i18nKey: 'tabs.today', icon: 'home' as const, iconFocused: 'home' as const },
  { name: 'messages', i18nKey: 'tabs.messages', icon: 'chatbubble-outline' as const, iconFocused: 'chatbubble' as const },
  { name: 'discover', i18nKey: 'tabs.collab', icon: 'search-outline' as const, iconFocused: 'search' as const },
  { name: 'plans', i18nKey: 'tabs.plans', icon: 'calendar-outline' as const, iconFocused: 'calendar' as const },
  { name: 'profile', i18nKey: 'tabs.profile', icon: 'person-outline' as const, iconFocused: 'person' as const },
] as const;

interface NotificationPayload {
  type?: 'invitation' | 'new_plan' | 'message' | 'questionnaire' | 'trainingPlanPublished' | 'nutritionPlanPublished'
  planId?: string
  threadId?: string
  planName?: string
  trainerName?: string
  startDate?: string
}

interface PersonalRecordAchievedPayload {
  clientId: string;
  exerciseExternalId: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  achievedAt: string;
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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const queryClient = useQueryClient();
  const registeredRef = useRef(false);
  const unreadMessages = useUnreadCount();

  // ── Hydration: v1→v3 migration effect (runs on app start) ─────────────────
  // Formerly lived in the hydration tab screen (now deleted). Cancels old
  // index-keyed reminder slots (water-slot-0..N-1) and re-schedules enabled
  // slots under their new UUID keys after a v1 migration.
  const pendingMigrationV1Count = useHydrationStore((s) => s.pendingMigrationV1Count);
  const hydrationSlots = useHydrationStore((s) => s.slots);
  const clearMigrationFlag = useHydrationStore((s) => s.clearMigrationFlag);

  useEffect(() => {
    if (pendingMigrationV1Count === 0) return;
    const runMigration = async () => {
      for (let i = 0; i < pendingMigrationV1Count; i++) {
        await cancelReminder(`water-slot-${i}`).catch(() => { /* best-effort */ });
      }
      for (const s of hydrationSlots) {
        if (s.enabled) {
          await scheduleDailyReminder({
            key: `water-slot-${s.id}`,
            time: { hour: s.hour, minute: s.minute },
            title: t('hydration.reminders.notificationTitle'),
            body: t('hydration.reminders.notificationBody'),
            data: { slotId: s.id },
          }).catch(() => { /* best-effort */ });
        }
      }
      clearMigrationFlag();
    };
    runMigration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMigrationV1Count]);

  // ── Hydration: orphan-reminder cleanup (UUID-based, runs on app start) ────
  // Formerly lived in the hydration tab screen (now deleted). Cancels any
  // water-slot-* MMKV reminder key whose suffix is not in the current UUID set.
  useEffect(() => {
    const knownIds = new Set(hydrationSlots.map((s) => s.id));
    const keys = listReminderKeys('water-slot-');
    for (const key of keys) {
      const suffix = key.slice('water-slot-'.length);
      if (!knownIds.has(suffix)) {
        cancelReminder(key).catch(() => { /* best-effort */ });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrationSlots]);

  // Register push token once
  useEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;
    registerPushToken();
  }, []);

  // Foreground: refresh queries when push notification arrives
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });

      const data = notification.request.content.data as NotificationPayload;
      if (data.type === 'trainingPlanPublished' || data.type === 'nutritionPlanPublished') {
        queryClient.invalidateQueries({ queryKey: ['nutrition-plan-full'] });
        queryClient.invalidateQueries({ queryKey: ['today-training'] });
        queryClient.invalidateQueries({ queryKey: ['collaborations'] });
        const label = data.type === 'trainingPlanPublished'
          ? t('notifications.trainingPlanPublished')
          : t('notifications.nutritionPlanPublished');
        Toast.show(label);
      }
    });
    return () => sub.remove();
  }, [queryClient, t]);

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
        localNotify(t('notifications.inviteAccepted'), t('notifications.inviteAcceptedBody'));
        queryClient.invalidateQueries({ queryKey: ['my-requests'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['collaborations'] });
        queryClient.invalidateQueries({ queryKey: ['collaboration'] });
        useAuthStore.getState().setPendingRequests([]);
        useAuthStore.getState().refreshProfile();
      }),
      onEvent('clientRequestRejected', (raw: unknown) => {
        localNotify(t('notifications.inviteDeclined'), t('notifications.inviteDeclinedBody'));
        queryClient.invalidateQueries({ queryKey: ['my-requests'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['collaboration'] });
        // Clear all pending requests and let the refetch repopulate
        useAuthStore.getState().setPendingRequests([]);
      }),
      onEvent('invitationReceived', (raw: unknown) => {
        const data = raw as {
          id?: string
          trainerId?: string
          trainerName?: string
          trainerRole?: string
          trainerCity?: string
          message?: string
        } | undefined;
        localNotify(t('notifications.newInvite'), data?.trainerName
          ? t('notifications.invitedBy', { name: data.trainerName })
          : t('notifications.newInviteFallback'));
        useMessagesStore.getState().showInviteBanner(data?.trainerName ?? 'Your trainer');

        // Set invite data directly in the cache from the event payload
        // so the InviteCard appears immediately without waiting for an API round-trip.
        // Do NOT invalidateQueries for client-invite here — that would trigger a
        // background refetch that could overwrite our cache with null if the API
        // endpoint has issues. The 30s polling interval handles eventual consistency.
        if (data?.id && data.trainerName) {
          queryClient.setQueryData(['client-invite'], {
            id: data.id,
            trainerId: data.trainerId ?? '',
            trainerName: data.trainerName,
            trainerRole: data.trainerRole ?? 'Trainer',
            trainerCity: data.trainerCity ?? '',
            message: data.message,
          });
        } else {
          // Fallback: if event payload is missing data, force a refetch
          queryClient.invalidateQueries({ queryKey: ['client-invite'] });
        }

        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }),
      onEvent('questionnaireAssigned', () => {
        localNotify(t('notifications.questionnaireAssigned'), t('notifications.questionnaireBody'));
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['pending-questionnaires'] });
        useAuthStore.getState().refreshProfile();
      }),
      onEvent('questionnaireCancelled', () => {
        localNotify(t('notifications.questionnaireCancelled'), t('notifications.questionnaireCancelledBody'));
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['pending-questionnaires'] });
        useAuthStore.getState().refreshProfile();
      }),
      onEvent('invitationCancelled', () => {
        localNotify(t('notifications.invitationCancelled'), t('notifications.invitationCancelledBody'));
        queryClient.invalidateQueries({ queryKey: ['client-invite'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }),
      onEvent('newMessage', (raw: unknown) => {
        const payload = raw as { conversationId?: string; senderName?: string };
        const currentPath = pathnameRef.current;
        const viewingThisChat = payload.conversationId && currentPath.includes(`/messages/${payload.conversationId}`);
        if (!viewingThisChat) {
          localNotify(t('notifications.newMessage'), payload.senderName ? t('notifications.newMessageBy', { name: payload.senderName }) : t('notifications.newMessageFallback'));
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
      onEvent('nutritionPlanPublished', () => {
        localNotify(t('notifications.nutritionPlanPublished'), t('notifications.nutritionPlanPublishedBody'));
        queryClient.invalidateQueries({ queryKey: ['nutrition-plan-full'] });
        queryClient.invalidateQueries({ queryKey: ['today-plan'] });
        queryClient.invalidateQueries({ queryKey: ['today-log'] });
        // Plans list updates live when a week gets published
        queryClient.invalidateQueries({ queryKey: ['client-plans-active'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }),
      onEvent('trainingPlanPublished', () => {
        localNotify(t('notifications.trainingPlanPublished'), t('notifications.trainingPlanPublishedBody'));
        // Invalidating ['client-plans-active'] causes useTodayState to refetch
        // and re-derive pending training plans directly from the API response,
        // so no Zustand store mutation is needed here.
        queryClient.invalidateQueries({ queryKey: ['nutrition-plan-full'] });
        queryClient.invalidateQueries({ queryKey: ['today-training'] });
        // Plans list updates live when a week gets published
        queryClient.invalidateQueries({ queryKey: ['client-plans-active'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        // Invalidate the full training plan detail query (broad predicate covers any planId)
        queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'training-full-plan' });
      }),
      onEvent('conversationUnarchived', (raw: unknown) => {
        const data = raw as { conversationId?: string; senderName?: string; isFormer?: boolean } | undefined;
        if (data?.conversationId && !data.isFormer) {
          useMessagesStore.getState().markAutoUnarchived(data.conversationId, data.senderName ?? '');
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          queryClient.invalidateQueries({ queryKey: ['archived-conversations'] });
        }
      }),
      // #548: trainingplanupdated — content edit without a publish event;
      // invalidate same keys as trainingPlanPublished so training screens refresh.
      onEvent('trainingplanupdated', (raw: unknown) => {
        const payload = raw as { planId?: string } | undefined;
        queryClient.invalidateQueries({ queryKey: ['today-training'] });
        queryClient.invalidateQueries({
          predicate: (q) =>
            q.queryKey[0] === 'training-full-plan' &&
            (payload?.planId == null || q.queryKey[1] === payload.planId),
        });
      }),
      onEvent('personalrecordachieved', (raw: unknown) => {
        const _p = raw as PersonalRecordAchievedPayload;
        void _p; // payload received; invalidate PR queries so cards refresh
        queryClient.invalidateQueries({ queryKey: ['personal-records-latest'] });
        queryClient.invalidateQueries({ queryKey: ['personal-records-all'] });
      }),
      onEvent('weeklycheckinrequested', (raw: unknown) => {
        const payload = raw as {
          weeklyCheckInId?: string
          profession?: string
          professionalName?: string
        } | undefined;
        localNotify(
          t('notifications.weeklyCheckInRequested'),
          payload?.professionalName
            ? t('notifications.weeklyCheckInRequestedBy', { name: payload.professionalName })
            : t('notifications.weeklyCheckInRequestedFallback'),
        );
        queryClient.invalidateQueries({ queryKey: ['current-weekly-check-ins'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }),
      onEvent('sessioneditlockchanged', (raw: unknown) => {
        const payload = raw as {
          planId: string;
          sessionId: string;
          state: 'Stable' | 'Editing' | 'Live';
          holder: 'Coach' | 'Client';
        };
        // Refresh the today training card so lock-state reads are current.
        queryClient.invalidateQueries({ queryKey: ['today-training'] });
        // Refresh the full training plan detail for the specific plan (same
        // predicate pattern as trainingPlanPublished above).
        queryClient.invalidateQueries({
          predicate: (q) =>
            q.queryKey[0] === 'training-full-plan' &&
            q.queryKey[1] === payload.planId,
        });
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
      disconnect().catch(() => {});
    };
  }, [queryClient, t]);

  // Background/tap: deep link on notification tap
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotificationPayload;
      switch (data.type) {
        case 'invitation':
          router.push('/(client)');
          break;
        case 'new_plan':
          if (data.planId) router.push(href(`/(client)/plans/${data.planId}`));
          break;
        case 'message':
          if (data.threadId) router.push(href(`/(client)/messages/${data.threadId}`));
          break;
        case 'questionnaire':
          router.push(href('/(client)/questionnaire'));
          break;
        case 'trainingPlanPublished':
        case 'nutritionPlanPublished':
          queryClient.invalidateQueries({ queryKey: ['nutrition-plan-full'] });
          queryClient.invalidateQueries({ queryKey: ['today-training'] });
          queryClient.invalidateQueries({ queryKey: ['collaborations'] });
          router.push('/(client)');
          break;
      }
    });
    return () => sub.remove();
  }, [router]);

  // Hide tab bar on sub-screens (chat detail, trainer profile, invite detail)
  const hideTabBar =
    pathname.match(/\/messages\/[^/]+$/) && !pathname.endsWith('/messages/archived') ||
    pathname.match(/\/discover\/[^/]+$/) && !pathname.endsWith('/discover') ||
    pathname.match(/\/plans\/[^/]+$/) && !pathname.endsWith('/plans') ||
    pathname.endsWith('/pending-questionnaires') ||
    pathname.includes('/nutrition/') && !pathname.endsWith('/nutrition/index') ||
    pathname.includes('/training/')

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: hideTabBar
          ? { display: 'none' }
          : {
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
            title: t(tab.i18nKey),
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
                  tabBarBadgeStyle: { backgroundColor: colors.gold, color: colors.onAccent, fontSize: 11 },
                }
              : {}),
          }}
        />
      ))}
      {/* Hide sub-navigators and utility routes from tab bar */}
      <Tabs.Screen name="training" options={{ href: null }} />
      <Tabs.Screen name="nutrition" options={{ href: null }} />
      <Tabs.Screen name="measurements" options={{ href: null }} />
      <Tabs.Screen name="pending-questionnaires" options={{ href: null }} />
    </Tabs>
  );
}
