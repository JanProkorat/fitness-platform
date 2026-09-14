import React, { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { type ColorScheme } from '@/constants/colors'
import { goldAlpha } from '@/constants/colors'
import { Type, interFamily } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import {
  TRAINING_ANIM_DURATION,
  trainingEasing,
} from './animations'
import { AnimatedCollapse } from './AnimatedCollapse'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import type { SessionPhotoDto } from '@/api/training'

const ANIM_DURATION = TRAINING_ANIM_DURATION
const easing = trainingEasing

/**
 * Maps a session's start hour to the prototype kind-color.
 *
 * Prototype mapping (components.css, kind-* palette):
 *   05–10  morning   → orange  #ff9500
 *   11–13  noon      → green   #34c759
 *   14–16  afternoon → blue    #007aff
 *   17–20  evening   → purple  #af52de
 *   else   late      → red     #ff3b30
 *
 * All colors are sourced from the theme (no inline hex).
 */
/**
 * Picks a color for the session card's left bar + expanded header tint.
 *
 *   - When the session has a known start hour, the color reflects the
 *     time-of-day (morning / noon / afternoon / evening / late).
 *   - When it doesn't, we fall back to a cycle keyed by `index` so multiple
 *     sessions on the same day each get a distinct hue (mirrors the prototype:
 *     session #1 orange, #2 blue, #3 purple, …).
 */
function sessionKindColor(
  startHour: number | null | undefined,
  colors: ColorScheme,
  index: number = 0,
): string {
  if (startHour == null) {
    // No start time recorded — cycle by sibling index so each session on the
    // same day gets a distinct hue. Order matches the prototype: orange, blue,
    // then expanded with the same kind palette.
    const cycle = [colors.orange, colors.blue, colors.purple, colors.green, colors.red]
    return cycle[index % cycle.length]
  }
  if (startHour >= 5 && startHour <= 10) return colors.orange
  if (startHour >= 11 && startHour <= 13) return colors.green
  if (startHour >= 14 && startHour <= 16) return colors.blue
  if (startHour >= 17 && startHour <= 20) return colors.purple
  return colors.red
}

interface ExpandableSessionCardProps {
  name: string
  /** Short descriptor e.g. "4 cviky · 45 min" */
  summaryText: string
  /**
   * Hour component (0–23) of the session's scheduled start time.
   * Used to pick a time-of-day accent color for the left bar and expanded
   * header tint. Null / undefined → falls back to the index-based cycle so
   * each session on the day gets a distinct hue.
   */
  startHour?: number | null
  /**
   * 0-based index of this session among its siblings on the same day.
   * Drives the fallback color cycle when `startHour` is unset.
   */
  index?: number
  defaultExpanded?: boolean
  /**
   * When true, suppresses the top hairline divider so the first session strip
   * doesn't have a border between it and the hero section above.
   * Mirrors the `isLast` pattern on MealRow — only the first session skips the
   * divider; all subsequent sessions get a hairline top border for separation.
   */
  isFirst?: boolean
  /**
   * Optional node injected at the right side of the header row, between the
   * camera button and the chevron. Use this to render a session-level checkbox.
   * Tapping the injected element should call `event.stopPropagation()` so it
   * does NOT collapse/expand the card.
   */
  headerRight?: React.ReactNode
  /**
   * Optional node rendered at the bottom of the expanded body, after all
   * children. Use this to inject a SessionReminderRow on the plan-detail
   * screen without coupling the card to the reminder infrastructure.
   */
  bodyFooter?: React.ReactNode
  /**
   * When true, renders this session as a fully-chromed standalone card
   * (rounded corners, horizontal margin, bottom gap, subtle shadow) — suitable
   * for plan-detail views where each session is visually separated.
   *
   * Default `false` keeps the flat full-width strip layout used on the Today
   * screen (no chrome, hairline top divider between siblings).
   */
  standalone?: boolean
  /**
   * When provided, renders a camera icon button in the header slot where the
   * progress pill previously appeared. The button fires `onPhotoPress` without
   * collapsing/expanding the card (uses `e.stopPropagation()`).
   *
   * When absent (e.g. plan-detail screen renders `ExpandableSessionCard`
   * directly with no photo handler), no camera button is rendered — keeping
   * the plan-detail path unchanged.
   */
  onPhotoPress?: () => void
  /**
   * Diary photos for this session's log entry. When non-empty, a tappable
   * gold photo-indicator badge is rendered in the header next to the camera
   * button. Tapping it opens an ImageLightbox scoped to THESE session photos
   * only — mirrors MealRow's `hasPhotos`/`photos` pattern exactly.
   */
  photos?: SessionPhotoDto[]
  /**
   * When true, renders an "upraveno" pill badge in the session header row,
   * mirroring the exercise-level badge from ExpandableExerciseCard.
   * Sourced from `hasModificationsBySession[sessionId]` (Today card) or
   * `session.hasModifications` (full-plan / plan-detail screen).
   */
  hasModifications?: boolean
  children: React.ReactNode
}

/**
 * Collapsible session card that mirrors .tp-session in the prototype.
 *
 * - A 4 px left bar colored by time-of-day (`startHour`) mirrors the
 *   `.tp-session.kind-*` border-left rule.
 * - When expanded, the header band is tinted with the same hue at 10% alpha
 *   (`kindColor + '1a'`), matching `.tp-session.kind-*.expanded .tp-session-header`.
 * - Uses `AnimatedCollapse` for the body — the same measured-height pattern as
 *   `MealCard` so the training and nutrition accordions feel identical.
 */
export function ExpandableSessionCard({
  name,
  summaryText,
  startHour,
  index = 0,
  defaultExpanded = false,
  isFirst = false,
  headerRight,
  standalone = false,
  children,
  bodyFooter,
  onPhotoPress,
  photos,
  hasModifications = false,
}: ExpandableSessionCardProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(defaultExpanded)
  const chevronProgress = useSharedValue(defaultExpanded ? 1 : 0)

  // Lightbox state — opened by tapping the gold photo-indicator badge in the header.
  // Mirrors MealRow's lightbox state (lines 99–112 of MealRow.tsx).
  const [lightboxVisible, setLightboxVisible] = useState(false)
  const photoList = photos ?? []
  const hasPhotos = photoList.length > 0
  const photoUrls = photoList.map((p) => p.blobUrl).filter((u): u is string => typeof u === 'string' && u.length > 0)
  const photoNotes = photoList.map((p) => p.note ?? null)

  const handleBadgePress = useCallback(() => {
    if (photoUrls.length > 0) setLightboxVisible(true)
  }, [photoUrls.length])

  const handleLightboxClose = useCallback(() => {
    setLightboxVisible(false)
  }, [])

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronProgress.value * 180}deg` }],
  }))

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      chevronProgress.value = withTiming(next ? 1 : 0, {
        duration: ANIM_DURATION,
        easing,
      })
      return next
    })
  }, [chevronProgress])

  // Left-bar accent color — derived from session start hour, matches prototype kind palette.
  const kindColor = sessionKindColor(startHour, colors, index)
  // Header tint when expanded: same hue at 10% alpha. '1a' = 26/255 ≈ 10.2%.
  const headerBg = isOpen ? kindColor + '1a' : 'transparent'

  return (
    <View
      style={[
        styles.card,
        standalone ? styles.cardStandalone : {
          borderTopWidth: isFirst ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: colors.sep2,
        },
        { backgroundColor: colors.bg2 },
        standalone && { shadowColor: colors.shadow },
      ]}
    >
      <Pressable onPress={handleToggle} style={[styles.header, { backgroundColor: headerBg }]}>
        {/* 4 × 32 px inline accent pill — matches MealRow's accentBar pattern, colored by time-of-day */}
        <View style={[styles.accentBar, { backgroundColor: kindColor }]} />
        {/* Name + summary — typography mirrors MealRow's accordion header so
            training + nutrition rows on the Today screen read as the same
            visual primitive (Type.body 700 with -0.2 tracking on the title,
            Type.caption1 on the meta line). */}
        <View style={styles.nameWrap}>
          <Text
            style={[
              Type.body,
              {
                color: colors.label,
                fontWeight: '700',
                letterSpacing: -0.2,
              },
            ]}
            numberOfLines={1}
          >
            {name}
          </Text>
          {/* Summary row: summary text + optional session-level "upraveno" badge.
              Mirrors ExpandableExerciseCard's summaryRow — same flexDirection,
              gap, and pill style so session and exercise badges are visually
              identical. */}
          {(summaryText.length > 0 || hasModifications) && (
            <View style={styles.summaryRow}>
              {summaryText.length > 0 && (
                <Text style={[Type.caption1, { color: colors.label2 }]} numberOfLines={1}>
                  {summaryText}
                </Text>
              )}
              {hasModifications && (
                <View style={[styles.modifiedBadge, { backgroundColor: colors.goldBg }]}>
                  <Text style={[styles.modifiedBadgeText, { color: colors.gold }]}>
                    {t('training.upraveno')}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Photo indicator badge — tappable, shown only when this session has
            diary photos. Mirrors MealRow's photoIndicator (lines 250–264):
            goldBg circle with a small camera icon that opens the per-session
            ImageLightbox when tapped. */}
        {hasPhotos && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.()
              handleBadgePress()
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('sessionLogPhoto.openPhotosA11y')}
            style={[styles.photoIndicator, { backgroundColor: colors.goldBg }]}
          >
            <Ionicons name="camera" size={11} color={colors.gold} />
          </Pressable>
        )}

        {/* Camera button — only rendered when onPhotoPress is provided.
            Mirrors MealRow's CameraButton: goldAlpha circle, Ionicons camera,
            stopPropagation so it doesn't toggle the card expand/collapse.
            Absent on plan-detail screen (no prop passed) — that path unchanged. */}
        {onPhotoPress != null && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.()
              onPhotoPress()
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('training.sessionPhotoA11y')}
            style={[
              styles.cameraBtn,
              {
                backgroundColor: goldAlpha['12'],
                borderColor: goldAlpha['35'],
              },
            ]}
          >
            <Ionicons name="camera" size={15} color={colors.onGoldChip} />
          </Pressable>
        )}

        {/* Optional header-right slot (e.g. session-level checkbox).
            Rendered directly — all three levels now use the same 24×24 checkbox
            so no fixed-width slot wrapper is needed for alignment. */}
        {headerRight !== undefined && headerRight}

        {/* Chevron */}
        <Animated.View style={[styles.chevron, chevronStyle]}>
          <Ionicons name="chevron-down" size={16} color={colors.label3} />
        </Animated.View>
      </Pressable>

      {/* Collapsible body — AnimatedCollapse renders content always (for
          measurement) and animates height. The hairline top border is applied
          only when expanded via the innerStyle prop so a collapsed card doesn't
          show a stray hairline beneath the header. */}
      <AnimatedCollapse
        expanded={isOpen}
        innerStyle={[
          styles.body,
          isOpen && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.sep },
        ]}
      >
        {children}
        {bodyFooter}
      </AnimatedCollapse>

      {/* Per-session photo lightbox — opened by tapping the gold badge in the
          header. Scoped to THIS session's photos only, mirroring MealRow's
          ImageLightbox render (lines 297–302 of MealRow.tsx). */}
      {hasPhotos && (
        <ImageLightbox
          visible={lightboxVisible}
          images={photoUrls}
          startIndex={0}
          onClose={handleLightboxClose}
          imageNotes={photoNotes}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  // Flat full-width strip — no rounded corners, no border, no shadow.
  // Top hairline divider is applied inline (suppressed on isFirst).
  // overflow:hidden clips the expanded body without a separate wrapper.
  card: {
    overflow: 'hidden',
  },
  // Standalone card chrome for plan-detail views — each session gets its own
  // rounded, shadowed card separated by bottom margin (no hairline dividers).
  cardStandalone: {
    borderRadius: Radius.md,
    marginHorizontal: 16,
    marginBottom: 12,
    // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    // Android shadow
    elevation: 3,
  },
  // 4 px × 32 px inline accent pill — matches MealRow's accentBar pattern.
  // Inline flex child at the very start of the header row; no absolute positioning.
  accentBar: {
    width: 4,
    height: 32,
    borderRadius: 2,
    flexShrink: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    // paddingVertical + gap match MealRow's `rowAccordion` (14 / 12) so
    // training and nutrition rows have the same row height + internal
    // rhythm on the Today screen.
    paddingVertical: 14,
    // paddingRight matches SectionHeader so the trailing checkbox + chevron
    // sit at the exact same X across both header families.
    // paddingLeft matches MealRow's left inset (14) now that the accent bar is
    // an inline flex child rather than an absolute overlay.
    paddingLeft: 14,
    paddingRight: 10,
    gap: 12,
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
  },
  /** Row wrapping summary text + optional "upraveno" badge — mirrors
   *  ExpandableExerciseCard.summaryRow for visual consistency. */
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  /** Small gold pill shown when hasModifications is true — mirrors
   *  ExpandableExerciseCard.modifiedBadge exactly (same padding, radius, font). */
  modifiedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  modifiedBadgeText: {
    fontFamily: interFamily('600'),
    fontSize: 10,
    fontWeight: '600',
  },
  /**
   * Gold-tinted circular camera button — mirrors MealRow's cameraBtn style.
   * 28×28 to match the prototype spec exactly.
   */
  cameraBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  /**
   * Small badge shown when this session has diary photos — mirrors
   * MealRow's photoIndicator style exactly (18×18, radius 9, goldBg fill).
   */
  photoIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chevron: {
    flexShrink: 0,
    marginLeft: 8,
  },
  body: {
    // borderTop is applied via innerStyle only when `isOpen` so a collapsed
    // card doesn't show a stray hairline beneath the header.
    // No horizontal padding — exercise rows are flush with the section edges
    // per prototype (.tp-session-exercises .tp-ex-card { margin:0 }).
    paddingTop: 0,
    paddingBottom: 0,
    gap: 0,
  },
})

export default ExpandableSessionCard
