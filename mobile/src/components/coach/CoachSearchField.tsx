import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import Animated, {
  interpolate,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import { tabBarCollapseMotion } from '@/theme/motion';

type CoachSearchFieldProps = {
  open: boolean;
  value: string;
  onChangeText: (value: string) => void;
  onOpen: () => void;
  onClose: () => void;
};

/** Round glass search button that grows into an iOS-style field above the keyboard, with a close button. */
export function CoachSearchField({ open, value, onChangeText, onOpen, onClose }: CoachSearchFieldProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const keyboard = useAnimatedKeyboard();
  const progress = useSharedValue(open ? 1 : 0);
  const inputRef = useRef<TextInput>(null);
  const tint = theme.scheme === 'dark' ? 'systemThinMaterialDark' : 'systemThinMaterialLight';

  const { searchFab, searchField, searchFieldGlyph } = theme.sizes;
  const gap = theme.spacing.sm;
  const rowWidth = windowWidth - 2 * theme.spacing.xxl;
  const openWidth = rowWidth - searchField - gap;
  const closedInset = (searchFab - searchFieldGlyph) / 2;
  const openInset = theme.spacing.lg;
  const bottom = insets.bottom + theme.spacing.xl;

  useEffect(() => {
    const target = open ? 1 : 0;
    progress.set(
      reduceMotion ? target : withTiming(target, { duration: tabBarCollapseMotion.duration }),
    );
    if (open) inputRef.current?.focus();
    else inputRef.current?.blur();
  }, [open, reduceMotion, progress]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.max(keyboard.height.get() - insets.bottom, 0) }],
  }));
  const fieldStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.get(), [0, 1], [searchFab, openWidth]),
    height: interpolate(progress.get(), [0, 1], [searchFab, searchField]),
  }));
  const iconStyle = useAnimatedStyle(() => ({
    paddingLeft: interpolate(progress.get(), [0, 1], [closedInset, openInset]),
  }));
  const inputStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const closeStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.get(), [0, 1], [0, searchField + gap]),
    opacity: progress.get(),
  }));

  return (
    <Animated.View pointerEvents="box-none" style={[styles.row, { bottom }, rowStyle]}>
      <Animated.View style={[styles.shadow, fieldStyle]}>
        <BlurView intensity={theme.glass.bar.intensity} tint={tint} style={styles.blur}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('coachSearch.searchButton')}
            disabled={open}
            onPress={onOpen}
            style={styles.fill}
          >
            <Animated.View style={[styles.content, iconStyle]}>
              <SymbolView
                name="magnifyingglass"
                tintColor={open ? theme.colors.muted : theme.colors.ink}
                size={searchFieldGlyph}
              />
              <Animated.View style={[styles.inputWrap, inputStyle]}>
                <TextInput
                  ref={inputRef}
                  value={value}
                  onChangeText={onChangeText}
                  editable={open}
                  accessibilityLabel={t('coachSearch.searchLabel')}
                  placeholder={t('coachSearch.searchPlaceholder')}
                  placeholderTextColor={theme.colors.muted}
                  selectionColor={theme.colors.accent}
                  returnKeyType="search"
                  autoCorrect={false}
                  maxLength={100}
                  style={styles.input}
                />
                {value.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('coachSearch.clearSearch')}
                    onPress={() => onChangeText('')}
                    style={styles.clear}
                  >
                    <View style={styles.clearDot}>
                      <SymbolView
                        name="xmark"
                        tintColor={theme.colors.ground}
                        size={theme.sizes.searchClearGlyph}
                      />
                    </View>
                  </Pressable>
                ) : null}
              </Animated.View>
            </Animated.View>
          </Pressable>
        </BlurView>
      </Animated.View>
      <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[styles.closeSlot, closeStyle]}>
        <View style={styles.shadowClose}>
          <BlurView intensity={theme.glass.bar.intensity} tint={tint} style={styles.blur}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('coachSearch.closeSearch')}
              importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
              onPress={onClose}
              style={[styles.fill, styles.closePress]}
            >
              <SymbolView name="xmark" tintColor={theme.colors.ink} size={theme.sizes.searchFieldGlyph} />
            </Pressable>
          </BlurView>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      position: 'absolute',
      right: theme.spacing.xxl,
      left: theme.spacing.xxl,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    shadow: {
      borderRadius: theme.radii.pill,
      boxShadow: theme.shadows.glass,
    },
    shadowClose: {
      width: theme.sizes.searchField,
      height: theme.sizes.searchField,
      alignSelf: 'flex-end',
      borderRadius: theme.radii.pill,
      boxShadow: theme.shadows.glass,
    },
    closeSlot: {
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    blur: {
      flex: 1,
      overflow: 'hidden',
      borderRadius: theme.radii.pill,
    },
    fill: {
      flex: 1,
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.glassBorder,
      backgroundColor: theme.colors.glassFill,
    },
    closePress: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      overflow: 'hidden',
    },
    inputWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      height: '100%',
    },
    input: {
      ...theme.typography.bodyLarge,
      flex: 1,
      height: '100%',
      padding: 0,
      color: theme.colors.ink,
    },
    clear: {
      width: theme.sizes.searchClear,
      height: theme.sizes.searchClear,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearDot: {
      width: theme.sizes.searchClearDot,
      height: theme.sizes.searchClearDot,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.muted,
    },
  });
