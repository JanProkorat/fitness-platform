import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { REQUEST_MESSAGE_MAX_LENGTH, classifySendRequestError } from '@/api/clientRequests';
import type { SendRequestFailure } from '@/api/clientRequests';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useSendClientRequest } from '@/hooks/useSendClientRequest';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { CoachAvatar } from './CoachAvatar';

export type RequestSheetCoach = {
  publicId: string;
  firstName?: string;
  lastName?: string;
  avatarBlobUrl?: string;
};

type RequestSheetProps = {
  visible: boolean;
  coach: RequestSheetCoach;
  onClose: () => void;
  onSent: () => void;
};

export function RequestSheet({ visible, ...rest }: RequestSheetProps) {
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

/** Failures that sending again cannot fix; the message stays readable until the sheet is closed. */
const FINAL_FAILURES: SendRequestFailure[] = [
  'notAccepting',
  'alreadyPending',
  'alreadyLinked',
  'notFound',
];

function SheetContent({ coach, onClose, onSent }: Omit<RequestSheetProps, 'visible'>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets);
  const [message, setMessage] = useState('');
  const [shareHistory, setShareHistory] = useState(false);
  const mutation = useSendClientRequest(coach.publicId);
  const name = coach.firstName ?? '';

  const failure = mutation.isError ? classifySendRequestError(mutation.error) : null;
  const isFinal = failure !== null && FINAL_FAILURES.includes(failure);
  const disabled = mutation.isPending || mutation.isSuccess || isFinal;

  const submit = () => {
    if (disabled) return;
    mutation.mutate({ message, shareHistory }, { onSuccess: onSent });
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View accessibilityViewIsModal accessibilityLabel={t('requestSheet.title', { name })} style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.header}>
            <CoachAvatar coach={coach} size={theme.sizes.coachAvatarSmall} initialsVariant="bodyStrong" />
            <View style={styles.headerCopy}>
              <Text variant="heading" accessibilityRole="header" numberOfLines={1}>
                {t('requestSheet.title', { name })}
              </Text>
              <Text variant="bodySmall" color="muted">
                {t('requestSheet.subtitle')}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              hitSlop={theme.spacing.xs}
              onPress={onClose}
              style={styles.cancel}
            >
              <Text variant="body" color="muted">
                {t('requestSheet.cancel')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text variant="label" color="muted">
              {t('requestSheet.messageLabel')}
            </Text>
            <View style={styles.messageBox}>
              <TextInput
                accessibilityLabel={t('requestSheet.messageLabel')}
                value={message}
                onChangeText={(value) => {
                  setMessage(value);
                  if (mutation.isError) mutation.reset();
                }}
                placeholder={t('requestSheet.messagePlaceholder')}
                placeholderTextColor={theme.colors.muted}
                selectionColor={theme.colors.accent}
                maxLength={REQUEST_MESSAGE_MAX_LENGTH}
                multiline
                textAlignVertical="top"
                style={styles.messageInput}
              />
              <Text variant="caption" color="muted" style={styles.counter}>
                {message.length}/{REQUEST_MESSAGE_MAX_LENGTH}
              </Text>
            </View>
          </View>

          <View style={styles.toggleCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text variant="bodyStrong">{t('requestSheet.historyLabel')}</Text>
                <Text variant="bodySmall" color="muted">
                  {t('requestSheet.historyHint', { name })}
                </Text>
              </View>
              <Switch
                accessibilityLabel={t('requestSheet.historyLabel')}
                value={shareHistory}
                onValueChange={setShareHistory}
                trackColor={{ true: theme.colors.nutrition, false: theme.colors.lineStrong }}
              />
            </View>
            <Text variant="caption" color="muted">
              {t('requestSheet.onboardingCaption', { name })}
            </Text>
          </View>

          {failure ? (
            <Text variant="label" color="error" accessibilityRole="alert">
              {t(`requestSheet.errors.${failure}`)}
            </Text>
          ) : null}
          <Button
            label={t('requestSheet.submit')}
            onPress={submit}
            disabled={disabled}
          />
        </ScrollView>
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
      maxHeight: '92%',
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
    content: {
      gap: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    cancel: {
      paddingHorizontal: theme.spacing.xxs,
    },
    field: {
      gap: theme.spacing.snug,
    },
    messageBox: {
      height: theme.sizes.messageField,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xs,
      borderRadius: theme.radii.field,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.fieldBorder,
      backgroundColor: theme.colors.field,
    },
    messageInput: {
      ...theme.typography.bodyLarge,
      flex: 1,
      padding: 0,
      color: theme.colors.ink,
    },
    counter: {
      alignSelf: 'flex-end',
    },
    toggleCard: {
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.field,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    toggleCopy: {
      flex: 1,
      minWidth: 0,
    },
  });
