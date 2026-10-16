import { Text } from 'react-native';

import { useTheme } from '@/theme';

export function Wordmark() {
  const theme = useTheme();

  return (
    <Text numberOfLines={1} style={[theme.typography.wordmark, { color: theme.colors.wordmarkInk }]}>
      FORM <Text style={{ color: theme.colors.wordmarkAccent }}>UP</Text>
    </Text>
  );
}
