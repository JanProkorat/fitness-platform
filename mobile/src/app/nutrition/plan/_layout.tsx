import { Stack } from 'expo-router';

/** The nutrition plan's own stack: the whole plan, and the weeks opened from it. */
export default function NutritionPlanLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
