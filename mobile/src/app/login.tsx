import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';

import { classifyLoginError, login } from '@/api/auth';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Wordmark } from '@/components/Wordmark';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type Credentials = { email: string; password: string };

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export default function LoginScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const passwordRef = useRef<TextInput>(null);
  const params = useLocalSearchParams<{ email?: string; registered?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({ email: address, password: secret }: Credentials) => {
      const tokens = await login(address, secret);
      await useAuthStore.getState().login(tokens.accessToken, tokens.refreshToken);
    },
  });

  const address = email.trim();
  const canSubmit = EMAIL_PATTERN.test(address) && password.length > 0;

  const submit = () => {
    if (mutation.isPending || !canSubmit) return;
    mutation.mutate({ email: address, password });
  };

  const edited = () => {
    if (mutation.isError) mutation.reset();
  };

  const failure = mutation.isError ? classifyLoginError(mutation.error) : null;
  const credentialsInvalid = failure === 'invalidCredentials';
  const iconProps = { tintColor: theme.colors.muted, size: theme.sizes.fieldIcon };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen scroll gutter={theme.spacing.xxxl} contentStyle={styles.content}>
        <View style={styles.form}>
          <View style={styles.wordmark}>
            <Wordmark />
          </View>
          <Text variant="display" accessibilityRole="header" style={styles.heading}>
            {t('auth.login.heading')}
          </Text>
          <Input
            label={t('auth.login.email')}
            placeholder={t('auth.login.emailPlaceholder')}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              edited();
            }}
            invalid={credentialsInvalid}
            leading={<SymbolView name="envelope" {...iconProps} />}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <Input
            label={t('auth.login.password')}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              edited();
            }}
            invalid={credentialsInvalid}
            inputRef={passwordRef}
            leading={<SymbolView name="lock" {...iconProps} />}
            trailing={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  passwordVisible ? t('auth.login.hidePassword') : t('auth.login.showPassword')
                }
                hitSlop={theme.spacing.xs}
                onPress={() => setPasswordVisible((visible) => !visible)}
              >
                <Text variant="label" color="muted">
                  {passwordVisible ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
                </Text>
              </Pressable>
            }
            secureTextEntry={!passwordVisible}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          <Pressable accessibilityRole="link" hitSlop={theme.spacing.xs} style={styles.forgot}>
            <Text variant="label" color="ink2">
              {t('auth.login.forgotPassword')}
            </Text>
          </Pressable>
          <Button
            label={t('auth.login.submit')}
            onPress={submit}
            disabled={mutation.isPending || !canSubmit}
            style={styles.submit}
          />
          {params.registered === '1' && !failure ? (
            <Text variant="label" color="muted" accessibilityRole="alert">
              {t('auth.login.registeredNotice')}
            </Text>
          ) : null}
          {failure ? (
            <Text variant="label" color="error" accessibilityRole="alert">
              {t(`auth.login.errors.${failure}`)}
            </Text>
          ) : null}
        </View>
        <View style={styles.footer}>
          <Text variant="bodySmall" color="muted">
            {t('auth.login.newHere')}
          </Text>
          <Pressable
            accessibilityRole="link"
            hitSlop={theme.spacing.xs}
            onPress={() => router.push('/register')}
          >
            <Text variant="link" color="accent">
              {t('auth.login.createAccount')}
            </Text>
          </Pressable>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.ground,
    },
    content: {
      flexGrow: 1,
      justifyContent: 'space-between',
      paddingTop: theme.sizes.authTop,
      paddingBottom: theme.sizes.authBottom,
    },
    form: {
      gap: theme.spacing.lg,
    },
    wordmark: {
      paddingBottom: theme.sizes.wordmarkGap,
    },
    heading: {
      paddingBottom: theme.sizes.authHeadingGap,
    },
    forgot: {
      alignSelf: 'flex-end',
    },
    submit: {
      marginTop: theme.spacing.snug,
    },
    footer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      columnGap: theme.spacing.xxs,
      paddingTop: theme.spacing.xxxl,
    },
  });
