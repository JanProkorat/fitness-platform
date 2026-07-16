/**
 * Unit tests for tabTransition.ts — the #811 slide replacement for the
 * #784 tab cross-fade.
 *
 * These focus on what a typecheck cannot prove: the interpolation math
 * (direction-correct output range) and the timing config shape. Visual
 * confirmation of the actual on-device slide is out of scope for this
 * suite — see the #811 dev-handoff for the deferred simulator pass.
 *
 * To run:
 *   cd mobile && npx jest src/lib/__tests__/tabTransition.test.ts
 */

import { Animated } from 'react-native';
import {
  getSlideOutputRange,
  tabSlideInterpolator,
  tabSlideTransitionSpec,
} from '../tabTransition';

describe('tabTransition', () => {
  describe('getSlideOutputRange', () => {
    it('maps progress -1/0/1 to -width/0/width for a given screen width', () => {
      expect(getSlideOutputRange(390)).toEqual([-390, 0, 390]);
    });

    it('is symmetric around 0 regardless of width', () => {
      const [negative, center, positive] = getSlideOutputRange(844);
      expect(center).toBe(0);
      expect(positive).toBe(-negative);
    });
  });

  describe('tabSlideTransitionSpec', () => {
    it('uses a timing animation', () => {
      expect(tabSlideTransitionSpec.animation).toBe('timing');
    });

    it('approximates the native push duration (~350ms)', () => {
      expect(tabSlideTransitionSpec.config.duration).toBe(350);
    });

    it('supplies an easing function (not the linear Animated default)', () => {
      expect(typeof tabSlideTransitionSpec.config.easing).toBe('function');
    });
  });

  describe('tabSlideInterpolator', () => {
    it('wires progress into a single translateX transform spanning the full screen width', () => {
      const progress = new Animated.Value(0);
      const interpolateSpy = jest.spyOn(progress, 'interpolate');

      const { sceneStyle } = tabSlideInterpolator({ current: { progress } });

      expect(interpolateSpy).toHaveBeenCalledTimes(1);
      const [config] = interpolateSpy.mock.calls[0];
      expect(config.inputRange).toEqual([-1, 0, 1]);
      // outputRange must be symmetric and non-zero (a real screen width),
      // matching getSlideOutputRange's contract.
      const [negative, center, positive] = config.outputRange as number[];
      expect(center).toBe(0);
      expect(positive).toBeGreaterThan(0);
      expect(negative).toBe(-positive);

      expect(sceneStyle.transform).toHaveLength(1);
      // The transform's translateX must be exactly what interpolate()
      // returned — no extra wrapping/opacity fade re-introduced.
      expect(sceneStyle.transform[0].translateX).toBe(
        interpolateSpy.mock.results[0].value,
      );
    });

    it('does not reintroduce the #784 opacity fade', () => {
      const progress = new Animated.Value(0);
      const { sceneStyle } = tabSlideInterpolator({ current: { progress } });

      expect(sceneStyle).not.toHaveProperty('opacity');
    });

    it('produces the same translateX target for progress -1 as it does for +1, mirrored', () => {
      // Sanity check that the interpolator is direction-symmetric: a screen
      // parked to the left (-1) and one parked to the right (+1) get
      // opposite-signed targets from the same width, so the observed slide
      // direction is entirely determined by which side BottomTabView parks
      // the outgoing/incoming screen on — not by anything interpolator-side.
      const progress = new Animated.Value(-1);
      const interpolateSpy = jest.spyOn(progress, 'interpolate');
      tabSlideInterpolator({ current: { progress } });
      const [config] = interpolateSpy.mock.calls[0];
      const [negative, , positive] = config.outputRange as number[];
      expect(negative).toBe(-positive);
    });
  });
});
