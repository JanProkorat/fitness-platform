import { Stack } from 'expo-router'

export default function HydrationLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  )
}
