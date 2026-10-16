import { Text as RNText } from 'react-native';
import type { TextProps as RNTextProps } from 'react-native';

import { useTheme } from '@/theme';
import type { Colors, TypographyRole } from '@/theme';

export type TextProps = RNTextProps & {
  /** Typography role from the theme (named `variant` because `role` is a React Native ARIA prop). */
  variant?: TypographyRole;
  color?: keyof Colors;
};

export function Text({ variant = 'body', color = 'ink', style, ...rest }: TextProps) {
  const theme = useTheme();
  return (
    <RNText {...rest} style={[theme.typography[variant], { color: theme.colors[color] }, style]} />
  );
}
