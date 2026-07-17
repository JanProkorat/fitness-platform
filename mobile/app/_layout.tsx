import '../src/i18n';
import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { useAuthStore, storage } from '@/stores/auth';
import { useOfflineMutations } from '@/hooks/useOfflineMutations';
import { queryClient } from '@/lib/queryClient';
import { markTokenConsumed, wasTokenConsumed } from '@/lib/e2eAuthBypass';

// ─── Root layout — provider wiring only ─────────────────────────────────────
//
// This is a trimmed clean-slate scaffold (see PLAN / cleanup-manifest for the
// #ui-redesign effort). All screens + the design-token system were removed;
// this file wires up the surviving infra (TanStack Query, i18n, auth restore,
// offline-mutation draining, the __DEV__ e2e-auth deep-link bypass) around a
// single placeholder route so Expo Router boots. No `useTheme()` dependency —
// intentional; the new design system will re-introduce theming later.

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

function AppShell() {
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const restoreSession = useAuthStore((s) => s.restoreSession);

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
    if (isInitialized) {
      SplashScreen.hideAsync();
    }
  }, [isInitialized]);

  if (!isInitialized) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
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
