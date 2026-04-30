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
      <Stack.Screen
        name="meal-log-photo"
        options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
      />
      <Stack.Screen
        name="plan-photos"
        options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
      />
      <Stack.Screen
        name="plan-photos-upload"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="profile-photos"
        options={{ animation: 'slide_from_right', headerShown: false }}
      />
      <Stack.Screen
        name="diary"
        options={{ animation: 'slide_from_right' }}
      />
    </Stack>
  )
}
