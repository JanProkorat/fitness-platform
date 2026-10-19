import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import '@/i18n';
import { LaunchScreen } from '@/components/LaunchScreen';
import { ProfileErrorState } from '@/components/ProfileErrorState';
import { useAuthPhase } from '@/hooks/useAuthPhase';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/auth';
import { fontAssets, useTheme } from '@/theme';
import { buildNavigationTheme } from '@/theme/navigationTheme';

SplashScreen.preventAutoHideAsync();

/** Screens are reachable only in the phase that owns them; this layout is the sole router. */
function AppStack({ phase, onRetry }: { phase: ReturnType<typeof useAuthPhase>['phase']; onRetry: () => void }) {
  if (phase === 'error') {
    return <ProfileErrorState onRetry={onRetry} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={phase === 'loggedOut' || phase === 'loading'}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'unverified'}>
        <Stack.Screen name="check-email" />
      </Stack.Protected>
      {/* Declaration order decides where a phase change lands: verify-email must never be the first screen available in any phase. */}
      <Stack.Protected
        guard={phase === 'loggedOut' || phase === 'loading' || phase === 'unverified'}
      >
        <Stack.Screen name="verify-email" />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'verified'}>
        <Stack.Screen name="verified" />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'onboarding'}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'coach'}>
        <Stack.Screen name="coach-pending" />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'home'}>
        <Stack.Screen name="index" />
      </Stack.Protected>
    </Stack>
  );
}

/** Content plus launch overlay; the overlay lifts once the session and profile are resolved. */
function AppShell() {
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const { phase, retry } = useAuthPhase();
  const [overlayVisible, setOverlayVisible] = useState(true);
  const handleLaunchExited = useCallback(() => setOverlayVisible(false), []);

  return (
    <>
      {isInitialized ? (
        <View
          style={styles.content}
          accessibilityElementsHidden={overlayVisible}
          importantForAccessibility={overlayVisible ? 'no-hide-descendants' : 'auto'}
        >
          <AppStack phase={phase} onRetry={retry} />
        </View>
      ) : null}
      {overlayVisible ? (
        <LaunchScreen
          ready={isInitialized && phase !== 'loading'}
          onExited={handleLaunchExited}
        />
      ) : null}
    </>
  );
}

export default function RootLayout() {
  const theme = useTheme();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const navigationTheme = useMemo(() => buildNavigationTheme(theme), [theme]);
  const fontsReady = fontsLoaded || fontError !== null;

  useEffect(() => {
    void useAuthStore.getState().restoreSession();
  }, []);

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsReady]);

  if (!fontsReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <AppShell />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
