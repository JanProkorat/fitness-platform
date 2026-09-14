import { Platform, ViewStyle } from 'react-native'

/**
 * Shared shadow presets used across card-like components.
 * Keep iOS shadow properties + Android elevation in sync.
 */

/** Subtle card shadow — used by invite banners, notification cards, etc. */
export const cardShadow: ViewStyle = Platform.select({
  ios: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: {
    elevation: 3,
  },
  default: {},
})
