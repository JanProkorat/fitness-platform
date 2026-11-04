import { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { REQUEST_MESSAGE_MAX_LENGTH, classifySendRequestError } from '@/api/clientRequests';
import type { SendRequestFailure } from '@/api/clientRequests';
import type { PublicProfilePackageDto } from '@/api/generated';
import { coachRoles } from '@/api/professionals';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useCoachProfile } from '@/hooks/useCoachProfile';
import { useSendClientRequest } from '@/hooks/useSendClientRequest';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import { requestSheetMotion, sheetDragMotion } from '@/theme/motion';

import { CoachAvatar } from './CoachAvatar';
import { PackageCarousel } from './PackageCarousel';

export type RequestSheetCoach = {
  publicId: string;
  firstName?: string;
  lastName?: string;
  avatarBlobUrl?: string;
};

type RequestSheetProps = {
  visible: boolean;
  coach: RequestSheetCoach;
  /** The coach's packages from their profile; none hides the picker. */
  packages?: PublicProfilePackageDto[];
  /** False while payments are hidden: the tiles leave their prices out. */
  showPrices?: boolean;
  onClose: () => void;
  onSent: () => void;
};

/**
 * The Modal stays mounted after `visible` turns false, until the content has slid out; every close
 * path (X, backdrop, Android back, a sent request) just asks the parent to hide it.
 */
export function RequestSheet({ visible, ...rest }: RequestSheetProps) {
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  const handleExited = useCallback(() => setMounted(false), []);
  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={rest.onClose}
    >
      <SheetContent {...rest} open={visible} onExited={handleExited} />
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

function SheetContent({
  coach,
  packages = [],
  showPrices = true,
  onClose,
  onSent,
  open,
  onExited,
}: Omit<RequestSheetProps, 'visible'> & {
  /** False once the parent hides the sheet: the content slides out, then reports `onExited`. */
  open: boolean;
  onExited: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets);
  const { height: windowHeight } = useWindowDimensions();
  const [translateY] = useState(() => new Animated.Value(windowHeight));
  const [backdropOpacity] = useState(() => new Animated.Value(0));

  // The sheet slides up while the backdrop fades in, and the reverse on close; Reduce Motion jumps.
  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      const sheetTarget = open ? 0 : windowHeight;
      const backdropTarget = open ? 1 : 0;
      if (reduced) {
        translateY.setValue(sheetTarget);
        backdropOpacity.setValue(backdropTarget);
        if (!open) onExited();
        return;
      }
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: sheetTarget,
          ...sheetDragMotion.spring,
          overshootClamping: true,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: backdropTarget,
          duration: requestSheetMotion.backdropDuration,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && !open) onExited();
      });
    });
    return () => {
      cancelled = true;
      translateY.stopAnimation();
      backdropOpacity.stopAnimation();
    };
  }, [open, windowHeight, translateY, backdropOpacity, onExited]);
  const [message, setMessage] = useState('');
  const [shareHistory, setShareHistory] = useState(false);
  const [packagePublicId, setPackagePublicId] = useState<string | undefined>(undefined);
  const mutation = useSendClientRequest(coach.publicId);
  const name = coach.firstName ?? '';
  // The profile is already cached behind the sheet; a coach holding both roles gets the neutral hint.
  const profile = useCoachProfile(coach.publicId);
  const heldRoles = coachRoles(profile.data?.roles);
  const historyHintKey = `requestSheet.historyHint.${heldRoles.length === 1 ? heldRoles[0] : 'Any'}`;
  const selectable = packages.filter((pack) => Boolean(pack.publicId));

  const failure = mutation.isError ? classifySendRequestError(mutation.error) : null;
  const isFinal = failure !== null && FINAL_FAILURES.includes(failure);
  const disabled = mutation.isPending || mutation.isSuccess || isFinal;

  const submit = () => {
    if (disabled) return;
    mutation.mutate(
      { message, shareHistory, packagePublicId },
      {
        onSuccess: onSent,
        onError: (error) => {
          // A package that is gone cannot be sent again; the coach profile refetches behind the sheet.
          if (classifySendRequestError(error) === 'packageUnavailable') setPackagePublicId(undefined);
        },
      },
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      pointerEvents={open ? 'auto' : 'none'}
    >
      {/* The dim fades on its own; the Pressable sits behind the sheet, so only taps outside it reach it. */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable accessible={false} onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel={t('requestSheet.title', { name })}
        style={[styles.sheet, { transform: [{ translateY }] }]}
      >
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
              accessibilityLabel={t('requestSheet.cancel')}
              hitSlop={theme.spacing.xs}
              onPress={onClose}
              style={styles.close}
            >
              <SymbolView name="xmark" tintColor={theme.colors.ink} size={theme.sizes.sheetCloseGlyph} />
            </Pressable>
          </View>

          {selectable.length > 0 ? (
            <View style={styles.field}>
              <PackageCarousel
                packages={selectable}
                showPrices={showPrices}
                label={t('requestSheet.packageLabel')}
                selection={{
                  selectedId: packagePublicId,
                  disabled: mutation.isPending || mutation.isSuccess,
                  onSelect: (publicId) => {
                    setPackagePublicId(publicId);
                    if (mutation.isError) mutation.reset();
                  },
                }}
              />
              <Text variant="caption" color="muted" style={styles.packageHint}>
                {t('requestSheet.packageHint', { name })}
              </Text>
            </View>
          ) : null}

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
                  {t(historyHintKey)}
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
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme: Theme, insets: EdgeInsets) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
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
    close: {
      width: theme.sizes.sheetClose,
      height: theme.sizes.sheetClose,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.lineStrong,
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
    packageHint: {
      paddingHorizontal: theme.spacing.xxs,
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
