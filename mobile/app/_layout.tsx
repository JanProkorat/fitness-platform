import '../src/i18n';
import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { href } from '@/lib/navigation';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useAuthStore, storage } from '@/stores/auth';
import { useOfflineMutations } from '@/hooks/useOfflineMutations';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ToastProvider } from '@/components/ui/Toast';
import { useTheme } from '@/hooks/useTheme';
import { queryClient } from '@/lib/queryClient';
import { markTokenConsumed, wasTokenConsumed } from '@/lib/e2eAuthBypass';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const colors = useTheme();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const user = useAuthStore((s) => s.user);
  const pendingInviteToken = useAuthStore((s) => s.pendingInviteToken);
  const setPendingInviteToken = useAuthStore((s) => s.setPendingInviteToken);

  // Load Inter weights used across the app — typography.ts maps fontWeight →
  // Inter_<weight><Name> family name. Splash stays up until the fonts are in.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useOfflineMutations();

  // __DEV__-only: QA auto-login bypass via deep link.
  // Fires on every inbound deep link; silently ignores anything that is not
  // fitnessplatform://e2e-auth?token=<refreshToken>.  Never runs in production
  // builds (__DEV__ is tree-shaken to false by Metro for release builds).
  useEffect(() => {
    if (!__DEV__) return;

    const handleUrl = (url: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      if (parsed.hostname !== 'e2e-auth') return;
      const token =
        typeof parsed.queryParams?.token === 'string'
          ? parsed.queryParams.token
          : null;
      if (!token) return;
      // Idempotency guard: Metro Fast Refresh can deliver the same URL via
      // both getInitialURL() and the url event in quick succession.
      // Consuming the same refresh token twice hits POST /auth/refresh with
      // an already-rotated token → 400 → logout catch block fires.
      if (wasTokenConsumed(token)) {
        console.log('[e2e-auth] duplicate deep-link suppressed (same token already consumed)');
        return;
      }
      console.log('[e2e-auth] login bypass invoked');
      storage.set('refreshToken', token);
      useAuthStore.setState({ refreshToken: token });
      useAuthStore.getState().restoreSession();
      markTokenConsumed(token);
    };

    // Cold-start: app was not running when the deep link was tapped.
    Linking.getInitialURL().then(handleUrl);
    // Warm: app was already running when the deep link arrived.
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (!isInitialized || !fontsLoaded) return;
    SplashScreen.hideAsync();

    const seg = segments as string[];
    const inAuthGroup = seg[0] === '(auth)';
    const currentScreen = seg[1] as string | undefined;
    const onVerifyScreen = inAuthGroup && currentScreen === 'verify-email';
    const onQuestionnaireScreen = inAuthGroup && currentScreen === 'questionnaire';
    const onInviteScreen = inAuthGroup && currentScreen === 'invite';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && !user?.emailConfirmed && !onVerifyScreen) {
      router.replace(href('/(auth)/verify-email'));
    } else if (isAuthenticated && user?.emailConfirmed && pendingInviteToken) {
      // Deterministic invite hand-off (#606). login.tsx recorded the intent
      // in the store instead of navigating imperatively — AuthGate is the
      // single routing authority so there is no race with the `/(client)`
      // branch below. Consume the flag before navigating so this branch
      // fires exactly once (onInviteScreen becomes true on the next run).
      const token = pendingInviteToken;
      setPendingInviteToken(null);
      router.replace(`/(auth)/invite/${token}`);
    } else if (isAuthenticated && user?.emailConfirmed && inAuthGroup && !onQuestionnaireScreen && !onInviteScreen) {
      router.replace('/(client)');
    }
  }, [isAuthenticated, isInitialized, fontsLoaded, segments, router, user, pendingInviteToken, setPendingInviteToken]);

  if (!isInitialized || !fontsLoaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <>
      <OfflineBanner />
      <ToastProvider />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
