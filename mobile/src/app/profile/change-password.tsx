import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { PasswordRules, passwordMeetsRules } from '@/components/PasswordRules';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useChangePassword } from '@/hooks/useChangePassword';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** Change password: current password, then the new one twice. */
export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    if (change.isSuccess) router.back();
  }, [change.isSuccess, router]);

  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit =
    current.length > 0 && passwordMeetsRules(next) && next === confirm && !change.isPending;

  const submit = () => {
    if (!canSubmit) return;
    change.submit({ currentPassword: current, newPassword: next });
  };

  const toggle = (
    <Pressable
      accessibilityRole="button"
      hitSlop={theme.spacing.xs}
      onPress={() => setShowPasswords((shown) => !shown)}
    >
      <Text variant="labelStrong" color="muted">
        {showPasswords ? t('settings.password.hide') : t('settings.password.show')}
      </Text>
    </Pressable>
  );

  return (
    <Screen
      scroll
      gutter={theme.spacing.xl}
      topGap={theme.spacing.safeAreaGap}
      bottomInset={theme.spacing.huge}
      contentStyle={styles.content}
    >
      <View style={styles.topBar}>
        <BackButton label={t('settings.back')} onPress={() => router.back()} />
      </View>
      <Text variant="title" accessibilityRole="header">
        {t('settings.password.title')}
      </Text>

      <View style={styles.form}>
        <Input
          label={t('settings.password.current')}
          value={current}
          onChangeText={(value) => {
            setCurrent(value);
            if (change.failure) change.reset();
          }}
          invalid={change.failure === 'invalidCurrent'}
          secureTextEntry={!showPasswords}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          trailing={toggle}
        />
        <Input
          label={t('settings.password.new')}
          value={next}
          onChangeText={setNext}
          secureTextEntry={!showPasswords}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <PasswordRules password={next} />
        <Input
          label={t('settings.password.confirm')}
          value={confirm}
          onChangeText={setConfirm}
          invalid={mismatch}
          secureTextEntry={!showPasswords}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        {mismatch ? (
          <Text variant="label" color="error" accessibilityRole="alert">
            {t('settings.password.mismatch')}
          </Text>
        ) : null}
        {change.failure ? (
          <Text variant="label" color="error" accessibilityRole="alert">
            {t(`settings.password.errors.${change.failure}`)}
          </Text>
        ) : null}
      </View>

      <Button label={t('settings.password.submit')} onPress={submit} disabled={!canSubmit} />
    </Screen>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.lg,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    form: {
      gap: theme.spacing.lg,
    },
  });
