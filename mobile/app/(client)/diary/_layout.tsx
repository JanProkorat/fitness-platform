import { Stack } from 'expo-router'

/**
 * Stack navigator for the photo-diary request flow.
 * The single child route is `[requestId]/`, whose nested layout owns
 * the per-request screens (index = accept wizard, bulk, workflow,
 * finalize, dismiss).
 */
export default function DiaryLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  )
}
