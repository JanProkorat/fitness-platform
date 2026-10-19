import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { addChips, MAX_CHIPS } from '@/api/onboarding';
import { Button } from '@/components/Button';
import { TagChip } from '@/components/onboarding/TagChip';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type ChipSheetProps = {
  visible: boolean;
  title: string;
  items: string[];
  /** Quick picks shown under the field; only some lists have them. */
  suggestions?: string[];
  onChange: (items: string[]) => void;
  onClose: () => void;
};

/** Bottom sheet for editing one chip list: type entries separated by commas, or tap a suggestion. */
export function ChipSheet({ visible, ...rest }: ChipSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={rest.onClose}
    >
      <SheetContent {...rest} />
    </Modal>
  );
}

function SheetContent({
  title,
  items,
  suggestions,
  onChange,
  onClose,
}: Omit<ChipSheetProps, 'visible'>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets);
  const inputRef = useRef<TextInput>(null);
  const [draft, setDraft] = useState('');
  const full = items.length >= MAX_CHIPS;

  const handleChange = (text: string) => {
    // A comma ends an entry: everything before the last one is committed, the rest stays as the draft.
    const lastComma = text.lastIndexOf(',');
    if (lastComma < 0) {
      setDraft(text);
      return;
    }
    onChange(addChips(items, text.slice(0, lastComma)));
    setDraft(text.slice(lastComma + 1));
  };

  const commitDraft = () => {
    const next = addChips(items, draft);
    if (next.length !== items.length) onChange(next);
    setDraft('');
  };

  const toggleSuggestion = (suggestion: string) => {
    const index = items.findIndex((item) => item.toLowerCase() === suggestion.toLowerCase());
    onChange(index >= 0 ? items.filter((_, at) => at !== index) : addChips(items, suggestion));
  };

  const finish = () => {
    commitDraft();
    onClose();
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View accessibilityViewIsModal accessibilityLabel={title} style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text variant="heading" accessibilityRole="header">
              {title}
            </Text>
            <Text variant="label" color="muted">
              {t('onboarding.sheet.added', { count: items.length })}
            </Text>
          </View>
          <Button label={t('onboarding.sheet.done')} size="small" onPress={finish} />
        </View>

        <View style={styles.group}>
          <Text variant="label" color="muted">
            {t('onboarding.sheet.hint')}
          </Text>
          <Pressable
            accessible={false}
            onPress={() => inputRef.current?.focus()}
            style={styles.field}
          >
            {items.map((item, index) => (
              <TagChip
                key={item}
                label={item}
                removeLabel={t('onboarding.removeItem', { item })}
                onRemove={() => onChange(items.filter((_, at) => at !== index))}
              />
            ))}
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={handleChange}
              onSubmitEditing={commitDraft}
              editable={!full}
              autoFocus
              autoCorrect={false}
              maxLength={200}
              returnKeyType="done"
              submitBehavior="submit"
              accessibilityLabel={title}
              placeholderTextColor={theme.colors.muted}
              selectionColor={theme.colors.accent}
              style={styles.input}
            />
          </Pressable>
        </View>

        {suggestions && suggestions.length > 0 ? (
          <View style={styles.group}>
            <Text variant="label" color="muted">
              {t('onboarding.sheet.common')}
            </Text>
            <View style={styles.suggestions}>
              {suggestions.map((suggestion) => {
                const added = items.some((item) => item.toLowerCase() === suggestion.toLowerCase());
                return (
                  <Pressable
                    key={suggestion}
                    accessibilityRole="button"
                    accessibilityState={{ selected: added }}
                    disabled={full && !added}
                    onPress={() => toggleSuggestion(suggestion)}
                    style={[styles.suggestion, added && styles.suggestionAdded]}
                  >
                    <SymbolView
                      name={added ? 'checkmark' : 'plus'}
                      weight="medium"
                      tintColor={theme.colors.ink}
                      size={theme.sizes.stepGlyph}
                    />
                    <Text variant={added ? 'bodyStrong' : 'body'}>{suggestion}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme: Theme, insets: EdgeInsets) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.glass.sheet.backdrop[theme.scheme],
    },
    sheet: {
      gap: theme.spacing.xxl,
      paddingTop: theme.spacing.xs,
      paddingHorizontal: theme.spacing.xxl,
      paddingBottom: Math.max(insets.bottom, theme.spacing.xl),
      borderTopLeftRadius: theme.glass.sheet.radius,
      borderTopRightRadius: theme.glass.sheet.radius,
      backgroundColor: theme.colors.surface,
    },
    handle: {
      alignSelf: 'center',
      width: theme.glass.sheet.handleWidth,
      height: theme.glass.sheet.handleHeight,
      borderRadius: theme.radii.xs,
      backgroundColor: theme.colors.lineStrong,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    titleBlock: {
      flex: 1,
      minWidth: 0,
    },
    group: {
      gap: theme.spacing.snug,
    },
    field: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing.xs,
      minHeight: theme.sizes.field,
      padding: theme.spacing.xs,
      borderRadius: theme.radii.field,
      borderWidth: theme.sizes.borderStrong,
      borderColor: theme.colors.ink2,
      backgroundColor: theme.colors.field,
    },
    input: {
      ...theme.typography.bodyLarge,
      flexGrow: 1,
      minWidth: theme.sizes.field * 2,
      height: theme.sizes.chip,
      padding: 0,
      color: theme.colors.ink,
    },
    suggestions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
    suggestion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      height: theme.sizes.field,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.borderStrong,
      borderColor: theme.colors.lineStrong,
    },
    suggestionAdded: {
      borderColor: theme.colors.primary,
    },
  });
