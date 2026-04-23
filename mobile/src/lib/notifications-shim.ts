// TypeScript resolution fallback for the platform-split
// `notifications-shim.{native,web}.ts` pair.
//
// Metro resolves `.native.ts` / `.web.ts` platform extensions at bundle time,
// so runtime code always hits the correct file. TypeScript 5.9 with
// `moduleResolution: bundler` does NOT apply Metro's platform-extension
// convention — it needs a bare module at the imported path to type-check. We
// re-export the native surface as the canonical type baseline, which also
// mirrors exactly what the web shim provides (both files export the same
// shape).

export * from './notifications-shim.native';
export { default } from './notifications-shim.native';
