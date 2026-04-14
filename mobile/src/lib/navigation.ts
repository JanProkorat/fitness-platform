import type { Href } from 'expo-router'

/**
 * Cast a route path to Expo Router's Href type.
 * Centralizes the type assertion so individual files don't need `as never` / `as any`.
 *
 * Usage:
 *   router.push(href('/(client)/messages'))
 *   router.push(href('/(client)/discover', { id: '123' }))
 */
export function href(path: string): Href {
  return path as Href
}

/**
 * Build a typed Href with route params.
 *
 * Usage:
 *   router.push(hrefParams('/nutrition/plan-detail', { week: '2' }))
 */
export function hrefParams(
  pathname: string,
  params: Record<string, string>,
): Href {
  return { pathname, params } as unknown as Href
}
