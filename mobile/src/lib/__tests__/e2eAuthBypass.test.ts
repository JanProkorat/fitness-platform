/**
 * Unit tests for e2eAuthBypass.ts — the idempotency guard for the QA
 * deep-link auth bypass.
 *
 * These are pure-logic tests with no React Native / Expo / MMKV dependencies.
 * The module exports are independent functions operating on a module-level
 * string slot, so no mocking is required.
 *
 * To run:
 *   cd mobile && npx jest src/lib/__tests__/e2eAuthBypass.test.ts
 */

// Ensure __DEV__ is truthy so the module functions are not no-ops.
// jest-expo sets __DEV__ = true in the test environment by default.

import {
  markTokenConsumed,
  wasTokenConsumed,
  resetConsumedTokens,
} from '../e2eAuthBypass';

// Reset the module-level slot between tests to keep them independent.
beforeEach(() => {
  resetConsumedTokens();
});

describe('e2eAuthBypass', () => {
  describe('markTokenConsumed + wasTokenConsumed', () => {
    it('wasTokenConsumed returns true for the most-recently-marked token', () => {
      markTokenConsumed('tok-abc');
      expect(wasTokenConsumed('tok-abc')).toBe(true);
    });

    it('wasTokenConsumed returns false for a different token than the one marked', () => {
      markTokenConsumed('tok-abc');
      expect(wasTokenConsumed('tok-xyz')).toBe(false);
    });

    it('wasTokenConsumed returns false when no token has been marked yet', () => {
      expect(wasTokenConsumed('tok-abc')).toBe(false);
    });

    it('marking a new token replaces the previous slot (only one slot tracked)', () => {
      markTokenConsumed('tok-first');
      markTokenConsumed('tok-second');
      // first token slot was replaced
      expect(wasTokenConsumed('tok-first')).toBe(false);
      expect(wasTokenConsumed('tok-second')).toBe(true);
    });
  });

  describe('resetConsumedTokens', () => {
    it('clears the slot so a previously-consumed token is no longer considered consumed', () => {
      markTokenConsumed('tok-abc');
      expect(wasTokenConsumed('tok-abc')).toBe(true);

      resetConsumedTokens();

      expect(wasTokenConsumed('tok-abc')).toBe(false);
    });

    it('allows a fresh token to be consumed after reset (AC2 regression guard)', () => {
      markTokenConsumed('tok-old');
      resetConsumedTokens();

      // Simulate a post-logout deep link with a fresh token.
      markTokenConsumed('tok-new');
      expect(wasTokenConsumed('tok-new')).toBe(true);
    });
  });
});
