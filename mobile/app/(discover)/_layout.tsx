import { Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

export default function DiscoverLayout() {
  const colors = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.label,
        headerTitleStyle: { fontWeight: '600', fontSize: 16 },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Najit trenera' }} />
      <Stack.Screen name="[professionalId]" options={{ title: 'Profil' }} />
    </Stack>
  );
}
