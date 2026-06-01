/**
 * Polyfill for crypto.randomUUID in insecure browser contexts.
 *
 * The Web Crypto spec gates crypto.randomUUID (and crypto.subtle) on secure
 * context (HTTPS or localhost). crypto.getRandomValues is available in all
 * contexts. This polyfill fills the gap so the app works on:
 *   - The dockerised e2e harness (http://web:5173, http://mobile-web:8081)
 *   - HTTP/LAN deployments (staging over plain HTTP, etc.)
 *
 * In secure contexts the native implementation is used unchanged (the `typeof`
 * guard short-circuits). The produced UUID is a compliant RFC-4122 v4 UUID.
 *
 * This file must be the FIRST import in main.tsx so the polyfill is in place
 * before any module that calls crypto.randomUUID() (toast store, nutrition /
 * training plan stores, SupplementsSection, NutritionPlanPage, TrainingPlanPage).
 */
if (typeof crypto.randomUUID !== 'function') {
  crypto.randomUUID = function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version 4 bits: byte 6 → 0b0100xxxx
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    // Set RFC 4122 variant bits: byte 8 → 0b10xxxxxx
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as `${string}-${string}-${string}-${string}-${string}`;
  };
}
