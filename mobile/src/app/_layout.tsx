import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import '@/i18n';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/auth';
import { fontAssets, useTheme } from '@/theme';
import { buildNavigationTheme } from '@/theme/navigationTheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const theme = useTheme();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const navigationTheme = useMemo(() => buildNavigationTheme(theme), [theme]);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const ready = (fontsLoaded || fontError !== null) && isInitialized;

  useEffect(() => {
    void useAuthStore.getState().restoreSession();
  }, []);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={isAuthenticated}>
            <Stack.Screen name="index" />
          </Stack.Protected>
          <Stack.Protected guard={!isAuthenticated}>
            <Stack.Screen name="login" />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
