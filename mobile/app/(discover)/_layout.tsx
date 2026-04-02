import { Stack } from 'expo-router';
import { Colors } from '../../constants/Colors';

export default function DiscoverLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.dark.background },
        headerTintColor: Colors.dark.text,
        headerTitleStyle: { fontWeight: '600', fontSize: 16 },
        contentStyle: { backgroundColor: Colors.dark.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Najit trenera' }} />
      <Stack.Screen name="[professionalId]" options={{ title: 'Profil' }} />
    </Stack>
  );
}
