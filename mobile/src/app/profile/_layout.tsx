import { Stack } from 'expo-router';

/** The Profile module's own stack; its sub-screens are added as files in this folder. */
export default function ProfileLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
