import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import '@/i18n';
import { LaunchScreen } from '@/components/LaunchScreen';
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
  const fontsReady = fontsLoaded || fontError !== null;
  const [overlayVisible, setOverlayVisible] = useState(true);
  const handleLaunchExited = useCallback(() => setOverlayVisible(false), []);

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
        {isInitialized ? (
          <View
            style={styles.content}
            accessibilityElementsHidden={overlayVisible}
            importantForAccessibility={overlayVisible ? 'no-hide-descendants' : 'auto'}
          >
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Protected guard={isAuthenticated}>
                <Stack.Screen name="index" />
              </Stack.Protected>
              <Stack.Protected guard={!isAuthenticated}>
                <Stack.Screen name="login" />
              </Stack.Protected>
            </Stack>
          </View>
        ) : null}
        {overlayVisible ? (
          <LaunchScreen ready={isInitialized} onExited={handleLaunchExited} />
        ) : null}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
