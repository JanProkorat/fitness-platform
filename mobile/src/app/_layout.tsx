import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';

import { fontAssets, useTheme } from '@/theme';
import { buildNavigationTheme } from '@/theme/navigationTheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const theme = useTheme();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const navigationTheme = useMemo(() => buildNavigationTheme(theme), [theme]);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack />
    </ThemeProvider>
  );
}
