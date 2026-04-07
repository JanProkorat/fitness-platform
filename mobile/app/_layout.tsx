import '../src/i18n';
import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../src/stores/auth';
import { useOfflineMutations } from '../src/hooks/useOfflineMutations';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { ToastProvider } from '@/components/ui/Toast';
import { Colors } from '@/constants/colors';
import { useTheme } from '@/hooks/useTheme';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 7 * 24 * 60 * 60_000,
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const colors = useTheme();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const user = useAuthStore((s) => s.user);

  useOfflineMutations();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (!isInitialized) return;
    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';
    const currentScreen = segments[1] as string | undefined;
    const onVerifyScreen = inAuthGroup && currentScreen === 'verify-email';
    const onQuestionnaireScreen = inAuthGroup && currentScreen === 'questionnaire';
    const onInviteScreen = inAuthGroup && currentScreen === 'invite';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && !user?.emailConfirmed && !onVerifyScreen) {
      router.replace('/(auth)/verify-email' as never);
    } else if (isAuthenticated && user?.emailConfirmed && user?.hasPendingQuestionnaire && !onQuestionnaireScreen && !inAuthGroup) {
      router.replace('/(auth)/questionnaire' as never);
    } else if (isAuthenticated && user?.emailConfirmed && inAuthGroup && !onQuestionnaireScreen && !onInviteScreen) {
      router.replace('/(client)');
    }
  }, [isAuthenticated, isInitialized, segments, router, user]);

  if (!isInitialized) {
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
