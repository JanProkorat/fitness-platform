import { Stack } from 'expo-router'

export default function ClientLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="today-shopping"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="food-detail"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="recipe-detail"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="training-session"
        options={{ animation: 'slide_from_right' }}
      />
    </Stack>
  )
}
