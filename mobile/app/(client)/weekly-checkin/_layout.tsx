import { Stack } from 'expo-router'

/**
 * Modal stack for the weekly check-in response sheet.
 * `presentation: 'modal'` makes the [id] screen slide up as a full-height modal.
 */
export default function WeeklyCheckInLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
        animation: 'slide_from_bottom',
      }}
    />
  )
}
