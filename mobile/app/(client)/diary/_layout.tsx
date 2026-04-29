import { Stack } from 'expo-router'

/**
 * Stack navigator for the photo-diary request flow.
 * All sub-screens (accept detail, dismiss) slide in from the right.
 * The dismiss screen is nested under `[requestId]/dismiss`.
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
