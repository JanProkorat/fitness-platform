/**
 * wodTimerStyles — shared StyleSheet for the WOD timer sub-components
 * (AmrapTimer, EmomTimer, TabataTimer, ForTimeTimer) and the WodTimerHero
 * dispatcher shell.
 *
 * Extracted verbatim from WodTimerHero.tsx during the #728 decomposition —
 * no value changes, no restyling. All four timers + the dispatcher import
 * `styles` from here so every consumer keeps using `styles.<key>` exactly
 * as before the split.
 */
import { StyleSheet } from 'react-native'
import { Radius } from '@/constants/radius'

export const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    // No bottom padding — the runner's `sectionHdrWrap` (paddingTop 8) below
    // owns the gap between the timer card and the PLÁN KOL header, matching
    // the SÉRIE TOHOTO CVIKU rhythm in standard sections.
    paddingBottom: 0,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  heroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 8,
    // Tighter than the previous 24 — the card felt overly airy. Combined
    // with bigTimer.lineHeight ≈ fontSize, finishBtn paddingVertical 0
    // and primaryBtn marginTop 0, every visible gap is ~16 px.
    gap: 16,
  },
  formatLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.08 * 11,
    marginBottom: 4,
  },
  bigTimer: {
    fontSize: 72,
    fontWeight: '700',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
    // Line-height matches fontSize so the textbox hugs the glyphs without
    // adding extra whitespace below — keeps the visible gap below the
    // timer equal to the configured `heroWrap.gap`.
    lineHeight: 72,
  },
  timerCaption: {
    fontSize: 12,
    marginTop: -4,
  },
  roundBadge: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  // Label used by AmrapTimer above the big timer — same size/weight as
  // the EMOM `roundBadge` so the two formats read at the same visual
  // weight, just title-case for the longer "Počet kol: N" string.
  amrapTopLabel: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  // Sub-line under the round badge — surfaces the per-round interval so the
  // user knows how long each round is before pressing play.
  intervalHint: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
  roundCounter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  roundCounterValue: {
    fontSize: 56,
    fontWeight: '700',
    lineHeight: 62,
    letterSpacing: -1,
  },
  roundCounterLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.08 * 11,
  },
  roundCounterHint: {
    fontSize: 10,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  repInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  stepperLabel: {
    fontSize: 13,
  },
  miniStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    height: 38,
    overflow: 'hidden',
  },
  miniStepBtn: {
    width: 36,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniStepText: {
    fontSize: 20,
    fontWeight: '500',
  },
  miniStepValue: {
    minWidth: 36,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  failedRoundsText: {
    fontSize: 12,
    fontWeight: '500',
  },
  phaseChip: {
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  phaseChipText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.08 * 13,
  },
  primaryBtn: {
    width: '100%',
    borderRadius: Radius.sm,
    paddingVertical: 15,
    alignItems: 'center',
    // marginTop removed — spacing now comes purely from `heroWrap.gap: 4`
    // so the gap between the round-counter button and the start button is
    // the same 4 px as the gap between the big-timer countdown and the
    // round counter above it.
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  finishBtn: {
    alignItems: 'center',
    // No inner vertical padding — spacing comes from heroWrap.gap so the
    // DOKONČIT row sits at the same distance from the Start button as the
    // other components.
    paddingVertical: 0,
  },
  finishBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  finishLargeBtn: {
    width: '100%',
    borderRadius: Radius.sm,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  finishLargeBtnText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  failRoundBtn: {
    width: '100%',
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  failRoundBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Three-icon control row used by EmomTimer + TabataTimer for prev / play /
  // next. Centred, spaced; the centre play-pause is the gold accent and
  // larger than the side step buttons.
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 4,
  },
  iconBtnSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPrimary: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Optical correction for the `play` triangle — see Ionicons usage above.
  playIconOpticalShift: {
    marginLeft: 3,
  },
  // Small "skip workout" link below the control row — neutral text, no
  // background. Tapping it stops the timer and finalises the workout via
  // the parent's onFinish (which forwards to the section-finished summary).
  skipWorkoutBtn: {
    alignItems: 'center',
    paddingVertical: 2,
    marginTop: 0,
  },
  skipWorkoutText: {
    fontSize: 13,
    fontWeight: '500',
  },
})
