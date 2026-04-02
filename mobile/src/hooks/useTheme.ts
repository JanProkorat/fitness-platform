import { useColorScheme } from 'react-native'
import { Colors, ColorScheme } from '@/constants/colors'
import { useThemeStore } from '@/stores/themeStore'

export function useTheme(): ColorScheme {
  const systemScheme = useColorScheme()
  const preference = useThemeStore((s) => s.preference)

  const effective =
    preference === 'system' ? (systemScheme ?? 'light') : preference

  return effective === 'dark' ? Colors.dark : Colors.light
}
