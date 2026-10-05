import type { TextStyle } from 'react-native';

import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { Outfit_300Light } from '@expo-google-fonts/outfit/300Light';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';

/** Font files to register with `useFonts`; keys are the family names the type tokens use. */
export const fontAssets = {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  Outfit_300Light,
  Outfit_600SemiBold,
};

export type FontFamily = keyof typeof fontAssets;

export type TypeStyle = {
  fontFamily: FontFamily;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
};

const style = (
  fontFamily: FontFamily,
  fontSize: number,
  lineHeight: number,
  letterSpacing?: number,
): TypeStyle => ({ fontFamily, fontSize, lineHeight, letterSpacing });

export const typography = {
  logo: style('Outfit_300Light', 30, 34, -0.45),
  title: style('Outfit_600SemiBold', 30, 34, -0.45),
  heading: style('DMSans_700Bold', 20, 26),
  subtitle: style('DMSans_600SemiBold', 17, 24),
  bodyLarge: style('DMSans_400Regular', 16, 24),
  body: style('DMSans_400Regular', 15, 22),
  bodyStrong: style('DMSans_600SemiBold', 15, 22),
  bodySmall: style('DMSans_400Regular', 14, 20),
  label: style('DMSans_500Medium', 13, 18),
  labelStrong: style('DMSans_600SemiBold', 13, 18),
  caption: style('DMSans_400Regular', 12, 16),
  captionStrong: style('DMSans_600SemiBold', 12, 16),
  overline: style('DMSans_600SemiBold', 11, 14, 0.4),
  micro: style('DMSans_600SemiBold', 10, 12),
  button: style('DMSans_600SemiBold', 16, 20),
  buttonSmall: style('DMSans_600SemiBold', 13, 16),
} satisfies Record<string, TypeStyle>;

export type TypographyRole = keyof typeof typography;

export const textStyle = (role: TypographyRole): TextStyle => typography[role];
