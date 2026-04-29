import { Stack } from 'expo-router'

/**
 * Stack navigator for screens nested under a specific diary request.
 * Currently contains the dismiss confirmation screen (#102).
 */
export default function DiaryRequestNestedLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  )
}
