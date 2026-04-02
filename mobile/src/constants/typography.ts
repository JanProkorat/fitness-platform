import { TextStyle } from 'react-native'

export const Type = {
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: -0.5 } as TextStyle,
  title1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.3 } as TextStyle,
  title2: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 } as TextStyle,
  title3: { fontSize: 20, fontWeight: '600' } as TextStyle,
  headline: { fontSize: 17, fontWeight: '600' } as TextStyle,
  body: { fontSize: 17, fontWeight: '400' } as TextStyle,
  callout: { fontSize: 16, fontWeight: '400' } as TextStyle,
  subheadline: { fontSize: 15, fontWeight: '400' } as TextStyle,
  footnote: { fontSize: 13, fontWeight: '400' } as TextStyle,
  caption1: { fontSize: 12, fontWeight: '400' } as TextStyle,
  caption2: { fontSize: 11, fontWeight: '400' } as TextStyle,
} as const
