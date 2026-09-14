import { Stack } from 'expo-router'

/**
 * Stack navigator for screens nested under a specific diary request:
 * - index (accept wizard, #99)
 * - bulk upload (#100)
 * - workflow + finalize (#101)
 * - dismiss (#102)
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
