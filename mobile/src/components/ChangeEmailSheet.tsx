import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { changeUnverifiedEmail, classifyChangeEmailError } from '@/api/register';
import type { ChangeEmailFailure, ChangedEmail } from '@/api/register';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

/** The backend compares the trimmed address case-insensitively. */
const normalize = (address: string): string => address.trim().toLowerCase();

type ChangeEmailSheetProps = {
  visible: boolean;
  /** The address the account has now; the new one must differ from it. */
  currentEmail: string;
  onClose: () => void;
  onChanged: (result: ChangedEmail) => void;
  /** The account turned out to be verified already. */
  onAlreadyVerified: () => void;
  /** The account has used up its verification emails. */
  onLimitReached: () => void;
};

export function ChangeEmailSheet({ visible, ...rest }: ChangeEmailSheetProps) {
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

const FIELD_FAILURES: ChangeEmailFailure[] = ['alreadyInUse', 'invalid'];

function SheetContent({
  currentEmail,
  onClose,
  onChanged,
  onAlreadyVerified,
  onLimitReached,
}: Omit<ChangeEmailSheetProps, 'visible'>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets);
  const [email, setEmail] = useState('');

  const mutation = useMutation({
    mutationFn: changeUnverifiedEmail,
    onSuccess: onChanged,
    onError: (error) => {
      const failure = classifyChangeEmailError(error);
      if (failure === 'alreadyVerified') onAlreadyVerified();
      if (failure === 'limitReached') onLimitReached();
    },
  });

  const classified = mutation.isError ? classifyChangeEmailError(mutation.error) : null;
  const failure = classified === 'alreadyVerified' ? null : classified;

  const address = email.trim();
  const canSubmit =
    EMAIL_PATTERN.test(address) && normalize(address) !== normalize(currentEmail);

  const submit = () => {
    if (mutation.isPending || mutation.isSuccess || !canSubmit) return;
    mutation.mutate(address);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        accessibilityViewIsModal
        accessibilityLabel={t('changeEmail.title')}
        style={styles.sheet}
      >
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text variant="heading" accessibilityRole="header" style={styles.title}>
            {t('changeEmail.title')}
          </Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={theme.spacing.xs}
            onPress={onClose}
            style={styles.cancel}
          >
            <Text variant="body" color="muted">
              {t('changeEmail.cancel')}
            </Text>
          </Pressable>
        </View>
        <Text variant="label" color="muted" style={styles.explain}>
          {t('changeEmail.explainStart')} <Text variant="labelStrong">{currentEmail}</Text>{' '}
          {t('changeEmail.explainEnd')}
        </Text>
        <Input
          label={t('changeEmail.newEmail')}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (mutation.isError) mutation.reset();
          }}
          invalid={failure !== null && FIELD_FAILURES.includes(failure)}
          autoFocus
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          maxLength={100}
          returnKeyType="send"
          onSubmitEditing={submit}
        />
        <Button
          label={t('changeEmail.submit')}
          onPress={submit}
          disabled={mutation.isPending || mutation.isSuccess || !canSubmit}
        />
        {failure ? (
          <Text variant="label" color="error" accessibilityRole="alert">
            {t(`changeEmail.errors.${failure}`)}
          </Text>
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
      gap: theme.spacing.lg,
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
    },
    title: {
      flex: 1,
    },
    cancel: {
      paddingHorizontal: theme.spacing.xxs,
    },
    explain: {
      lineHeight: theme.typography.body.lineHeight,
    },
  });
