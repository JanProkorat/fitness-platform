import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, NativeSyntheticEvent, TextLayoutEventData } from 'react-native';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import { noteExpandMotion } from '@/theme/motion';
import type { Theme } from '@/theme';

/** Lines a note shows before it is cut with "…"; tapping it slides the rest open. */
const NOTE_PREVIEW_LINES = 2;

/** The note's text without surrounding whitespace, or undefined when there is nothing to show. */
export function trimmedNote(note: string | null | undefined): string | undefined {
  const text = note?.trim();
  return text ? text : undefined;
}

type NoteBoxProps = {
  label: string;
  note: string | null | undefined;
};

/**
 * A coach note in a soft grey box: bubble glyph inline at the start of the first line, bold label, then the text
 * wrapping under the glyph. A note longer than two lines is cut with "…" and slides open on tap. Renders nothing for
 * an empty note.
 */
export function NoteBox({ label, note }: NoteBoxProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const reduceMotion = useReducedMotion();
  const [long, setLong] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Full text stays rendered while the box shrinks back, so the "…" only returns once it has closed.
  const [showFull, setShowFull] = useState(false);
  const [heights, setHeights] = useState({ full: 0, preview: 0 });
  const height = useSharedValue(-1);
  const clipStyle = useAnimatedStyle(() => (height.value < 0 ? {} : { height: height.value }));

  const text = trimmedNote(note);
  if (!text) return null;

  const body = (lines?: number, onTextLayout?: (event: NativeSyntheticEvent<TextLayoutEventData>) => void) => (
    <Text variant="bodySmall" numberOfLines={lines} onTextLayout={onTextLayout}>
      <View style={styles.glyph}>
        <SymbolView name="text.bubble" weight="medium" tintColor={theme.colors.muted} size={theme.sizes.noteGlyph} />
      </View>
      <Text variant="link">{` ${label}`}</Text>
      <Text variant="bodySmall" color="muted">
        {` · ${text}`}
      </Text>
    </Text>
  );

  const onFullLayout = (event: LayoutChangeEvent) => {
    const full = event.nativeEvent.layout.height;
    setHeights((current) => ({ ...current, full }));
    if (expanded) height.set(full);
  };
  const onPreviewLayout = (event: LayoutChangeEvent) => {
    const preview = event.nativeEvent.layout.height;
    setHeights((current) => ({ ...current, preview }));
    if (!expanded) height.set(preview);
  };

  const animateTo = (target: number, onDone?: () => void) => {
    if (reduceMotion) {
      height.set(target);
      onDone?.();
      return;
    }
    height.set(
      withTiming(target, { duration: noteExpandMotion.duration, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished && onDone) scheduleOnRN(onDone);
      }),
    );
  };

  const toggle = () => {
    if (expanded) {
      setExpanded(false);
      animateTo(heights.preview, () => setShowFull(false));
    } else {
      setExpanded(true);
      setShowFull(true);
      animateTo(heights.full);
    }
  };

  return (
    <View style={styles.box}>
      <View>
        {/* Invisible copies at the same width: the full height, and the preview's height and line count. */}
        <View style={styles.measure} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View onLayout={onFullLayout}>
            {body(undefined, (event) => setLong(event.nativeEvent.lines.length > NOTE_PREVIEW_LINES))}
          </View>
        </View>
        <View style={styles.measure} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View onLayout={onPreviewLayout}>{body(NOTE_PREVIEW_LINES)}</View>
        </View>
        {long ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityHint={t(expanded ? 'nutritionPlan.note.collapse' : 'nutritionPlan.note.expand')}
            onPress={toggle}
          >
            <Reanimated.View style={[styles.clip, clipStyle]}>
              {body(showFull ? undefined : NOTE_PREVIEW_LINES)}
            </Reanimated.View>
          </Pressable>
        ) : (
          body()
        )}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    box: {
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.field,
      marginVertical: theme.spacing.snug,
    },
    // Inline views need a fixed size inside Text.
    glyph: {
      width: theme.sizes.noteGlyph,
      height: theme.sizes.noteGlyph,
    },
    clip: {
      overflow: 'hidden',
    },
    measure: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      opacity: 0,
    },
  });
