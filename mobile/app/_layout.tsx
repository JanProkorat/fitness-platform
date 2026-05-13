import '../src/i18n';
import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { href } from '@/lib/navigation';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useAuthStore } from '@/stores/auth';
import { useOfflineMutations } from '@/hooks/useOfflineMutations';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ToastProvider } from '@/components/ui/Toast';
import { useTheme } from '@/hooks/useTheme';
import { queryClient } from '@/lib/queryClient';

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

  // Load Inter weights used across the app — typography.ts maps fontWeight →
  // Inter_<weight><Name> family name. Splash stays up until the fonts are in.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useOfflineMutations();

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
    } else if (isAuthenticated && user?.emailConfirmed && inAuthGroup && !onQuestionnaireScreen && !onInviteScreen) {
      router.replace('/(client)');
    }
  }, [isAuthenticated, isInitialized, fontsLoaded, segments, router, user]);

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
