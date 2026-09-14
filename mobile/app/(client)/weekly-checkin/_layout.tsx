import { Stack } from 'expo-router'

/**
 * Card-push stack for the weekly check-in response screen.
 * Mirrors training-session/_layout.tsx — a standard card push with a
 * custom in-screen chevron-back header (see [id].tsx), not a modal sheet.
 */
export default function WeeklyCheckInLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  )
}
