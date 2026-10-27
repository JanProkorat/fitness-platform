import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { registerPushToken, rememberRegisteredToken, removePushTokenAs } from '@/api/pushToken';
import { isPaymentRequestedType } from '@/api/payments';
import { usePaymentsEnabled } from '@/hooks/usePaymentsEnabled';
import i18n from '@/i18n';
import { useAuthStore } from '@/stores/auth';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const ANDROID_CHANNEL_ID = 'default';

/** Asks for permission when needed and returns the Expo push token, or null when there is none. */
async function obtainExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: i18n.t('push.channelName'),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (!permission.granted) return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return data;
}

/**
 * Prompts for notification permission and registers this device's push token for the signed-in
 * user, once per session. Any failure is logged and not retried; a registration that finishes
 * after the session ended is dropped and, if it already reached the server, taken back.
 */
export function usePushRegistration(): void {
  const sessionGeneration = useAuthStore((state) => state.sessionGeneration);

  useEffect(() => {
    const startedAccessToken = useAuthStore.getState().accessToken;
    const sessionEnded = () => useAuthStore.getState().sessionGeneration !== sessionGeneration;

    void (async () => {
      let token: string | null = null;
      try {
        token = await obtainExpoPushToken();
        if (!token || sessionEnded()) return;
        await registerPushToken(token);
        if (sessionEnded()) {
          if (startedAccessToken) await removePushTokenAs(startedAccessToken, token);
          return;
        }
        await rememberRegisteredToken(token);
      } catch (error) {
        // Android without FCM configuration fails here; push is simply unavailable then.
        console.warn('Push registration failed', error);
      }
    })();
  }, [sessionGeneration]);
}

/** Notification id of the last tap that was acted on, so a replayed response is not handled twice. */
let handledResponseId: string | null = null;

/**
 * Opens the invite or payments list a tapped push notification points at, or Today when it carries
 * none (or payments are hidden).
 * Mount it only once the user is on the home screens, so a cold-start tap waits for sign-in.
 */
export function usePushTapNavigation(): void {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const { enabled: paymentsEnabled, settled: paymentsSettled } = usePaymentsEnabled();

  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const { identifier, content } = response.notification.request;
    if (handledResponseId === identifier) return;

    const isPayment = isPaymentRequestedType(content.data?.type);
    // A payment tap waits for the server switch: on a cold start it is not known yet.
    if (isPayment && !paymentsSettled) return;
    handledResponseId = identifier;

    const inviteId = content.data?.inviteId;
    try {
      if (isPayment && paymentsEnabled) {
        router.push('/payments');
      } else if (typeof inviteId === 'string' && inviteId.length > 0) {
        router.push({ pathname: '/invite/[id]', params: { id: inviteId } });
      } else {
        router.navigate('/');
      }
    } catch (error) {
      console.warn('Could not open the notification target', error);
    }
  }, [response, router, paymentsEnabled, paymentsSettled]);
}
