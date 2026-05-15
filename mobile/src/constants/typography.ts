import { TextStyle } from 'react-native'

/**
 * Type scale — Inter (loaded in `app/_layout.tsx` via `@expo-google-fonts/inter`).
 *
 * RN doesn't synthesize weights, so each `fontWeight` is paired with the
 * matching Inter face (`Inter_<weight><Name>`). Components that override
 * `fontWeight` inline must keep using one of the four weights below — anything
 * else falls back to the system font.
 */

const inter = {
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
} as const

export type InterWeight = keyof typeof inter

/**
 * Resolves an Inter family name from a numeric weight string. Components that
 * mix `fontFamily` with `fontWeight` directly should call this so the right
 * face is loaded — otherwise RN renders an unstyled fallback.
 */
export function interFamily(weight: InterWeight): string {
  return inter[weight]
}

export const Type = {
  largeTitle: {
    fontFamily: inter['700'], fontSize: 34, fontWeight: '700', letterSpacing: -0.5,
  } as TextStyle,
  title1: {
    fontFamily: inter['700'], fontSize: 28, fontWeight: '700', letterSpacing: -0.3,
  } as TextStyle,
  title2: {
    fontFamily: inter['700'], fontSize: 22, fontWeight: '700', letterSpacing: -0.3,
  } as TextStyle,
  title3: {
    fontFamily: inter['600'], fontSize: 20, fontWeight: '600',
  } as TextStyle,
  headline: {
    fontFamily: inter['600'], fontSize: 17, fontWeight: '600',
  } as TextStyle,
  body: {
    fontFamily: inter['400'], fontSize: 17, fontWeight: '400',
  } as TextStyle,
  callout: {
    fontFamily: inter['400'], fontSize: 16, fontWeight: '400',
  } as TextStyle,
  subheadline: {
    fontFamily: inter['400'], fontSize: 15, fontWeight: '400',
  } as TextStyle,
  footnote: {
    fontFamily: inter['400'], fontSize: 13, fontWeight: '400',
  } as TextStyle,
  caption1: {
    fontFamily: inter['400'], fontSize: 12, fontWeight: '400',
  } as TextStyle,
  caption2: {
    fontFamily: inter['400'], fontSize: 11, fontWeight: '400',
  } as TextStyle,
} as const
