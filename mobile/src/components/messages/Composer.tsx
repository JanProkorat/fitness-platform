import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { MESSAGE_MAX_LENGTH } from '@/api/conversations';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type ComposerProps = {
  draft: string;
  onChangeDraft: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  /** Shown under the field when the last send failed; the draft is still in the field. */
  failed: boolean;
};

/** Message field and send button. The draft stays in the field until the server has taken it. */
export function Composer({ draft, onChangeDraft, onSend, sending, failed }: ComposerProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const canSend = draft.trim().length > 0 && !sending;

  return (
    <View style={styles.wrap}>
      {failed ? (
        <Text variant="caption" style={{ color: theme.colors.error }} accessibilityLiveRegion="polite">
          {t('chat.sendFailed')}
        </Text>
      ) : null}
      <View style={styles.field}>
        <TextInput
          value={draft}
          onChangeText={onChangeDraft}
          placeholder={t('chat.composerPlaceholder')}
          placeholderTextColor={theme.colors.muted}
          maxLength={MESSAGE_MAX_LENGTH}
          multiline
          style={[theme.typography.bodyLarge, styles.input]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('chat.send')}
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={onSend}
          style={[styles.send, !canSend && styles.sendDisabled]}
        >
          <SymbolView name="arrow.up" weight="semibold" tintColor={theme.colors.onAccent} size={theme.sizes.sendGlyph} />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      gap: theme.spacing.xs,
    },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      minHeight: theme.sizes.composer,
      paddingVertical: theme.spacing.xxs,
      paddingLeft: theme.spacing.xxl,
      paddingRight: theme.spacing.xxs,
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.glass,
    },
    input: {
      flex: 1,
      maxHeight: theme.sizes.messageField,
      paddingVertical: theme.spacing.xs,
      color: theme.colors.ink,
    },
    send: {
      width: theme.sizes.sendButton,
      height: theme.sizes.sendButton,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.accent,
    },
    sendDisabled: {
      opacity: theme.opacity.disabled,
    },
  });
