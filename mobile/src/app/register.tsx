import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';

import { login } from '@/api/auth';
import { ROLE_CLIENT, ROLE_NUTRITIONIST, ROLE_TRAINER } from '@/api/profile';
import { AutoLoginError, classifyRegisterError, register } from '@/api/register';
import type { RegisterField, RegisterInput } from '@/api/register';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { Input } from '@/components/Input';
import { PasswordRules, passwordMeetsRules } from '@/components/PasswordRules';
import { RoleCard } from '@/components/RoleCard';
import type { RoleTone } from '@/components/RoleCard';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type FieldErrors = Partial<Record<RegisterField | 'gdpr' | 'health', string>>;

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const ROLE_OPTIONS: {
  role: string;
  key: 'client' | 'trainer' | 'nutritionist';
  symbol: 'person' | 'figure.strengthtraining.traditional' | 'leaf';
  tone: RoleTone;
}[] = [
  { role: ROLE_CLIENT, key: 'client', symbol: 'person', tone: 'client' },
  {
    role: ROLE_TRAINER,
    key: 'trainer',
    symbol: 'figure.strengthtraining.traditional',
    tone: 'training',
  },
  { role: ROLE_NUTRITIONIST, key: 'nutritionist', symbol: 'leaf', tone: 'nutrition' },
];

/** Client is exclusive; Trainer and Nutritionist combine, and at least one role stays picked. */
function toggleRole(current: string[], role: string): string[] {
  if (role === ROLE_CLIENT) return [ROLE_CLIENT];
  const coaches = current.filter((picked) => picked !== ROLE_CLIENT);
  const next = coaches.includes(role) ? coaches.filter((picked) => picked !== role) : [...coaches, role];
  return next.length > 0 ? next : coaches;
}

export default function RegisterScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [roles, setRoles] = useState<string[]>([ROLE_CLIENT]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [healthConsent, setHealthConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const isClient = roles.includes(ROLE_CLIENT);

  const mutation = useMutation({
    mutationFn: async (input: RegisterInput) => {
      await register(input);
      // The account now exists: a failure from here on must never re-submit the registration.
      try {
        const tokens = await login(input.email, input.password);
        await useAuthStore.getState().login(tokens.accessToken, tokens.refreshToken);
      } catch (cause) {
        throw new AutoLoginError(cause);
      }
    },
    onError: (error, input) => {
      if (error instanceof AutoLoginError) {
        router.replace({ pathname: '/login', params: { email: input.email, registered: '1' } });
      }
    },
  });

  const failure =
    mutation.isError && !(mutation.error instanceof AutoLoginError)
      ? classifyRegisterError(mutation.error)
      : null;

  const clear = (field: keyof FieldErrors) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    if (mutation.isError) mutation.reset();
  };

  const submit = () => {
    if (mutation.isPending || mutation.isSuccess) return;
    const address = email.trim();
    const errors: FieldErrors = {};
    if (!firstName.trim()) errors.firstName = t('auth.register.validation.firstNameRequired');
    if (!lastName.trim()) errors.lastName = t('auth.register.validation.lastNameRequired');
    if (!address) {
      errors.email = t('auth.register.validation.emailRequired');
    } else if (!EMAIL_PATTERN.test(address)) {
      errors.email = t('auth.register.validation.emailInvalid');
    }
    if (!passwordMeetsRules(password)) errors.password = t('auth.register.validation.passwordRules');
    if (!gdprConsent) errors.gdpr = t('auth.register.validation.gdprRequired');
    if (isClient && !healthConsent) errors.health = t('auth.register.validation.healthRequired');
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    mutation.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: address,
      password,
      roles,
      gdprConsent,
      healthDataConsent: isClient && healthConsent,
    });
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login');
    }
  };

  const serverFieldError = (field: RegisterField): string | undefined => {
    if (failure?.kind === 'duplicateEmail' && field === 'email') {
      return t('auth.register.errors.duplicateEmail');
    }
    if (failure?.kind === 'validation' && failure.fields.includes(field)) {
      return t('auth.register.errors.validation');
    }
    return undefined;
  };

  const bannerKey =
    failure?.kind === 'rateLimited' || failure?.kind === 'network' || failure?.kind === 'generic'
      ? failure.kind
      : failure?.kind === 'validation' && failure.fields.length === 0
        ? 'generic'
        : null;

  const iconProps = { tintColor: theme.colors.muted, size: theme.sizes.fieldIcon };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen scroll contentStyle={styles.content}>
        <View style={styles.topBar}>
          <BackButton label={t('auth.register.back')} onPress={goBack} />
        </View>
        <View style={styles.header}>
          <Text variant="title" accessibilityRole="header">
            {t('auth.register.heading')}
          </Text>
          <Text variant="body" color="muted">
            {t('auth.register.subtitle')}
          </Text>
        </View>

        <View accessibilityRole="radiogroup" style={styles.group}>
          <Text variant="label" color="muted">
            {t('auth.register.roleLabel')}
          </Text>
          <View style={styles.roles}>
            {ROLE_OPTIONS.map(({ role, key, symbol, tone }) => (
              <RoleCard
                key={role}
                label={t(`auth.register.roles.${key}.title`)}
                hint={t(`auth.register.roles.${key}.hint`)}
                symbol={symbol}
                tone={tone}
                selected={roles.includes(role)}
                onPress={() => {
                  setRoles((current) => toggleRole(current, role));
                  clear('health');
                }}
              />
            ))}
          </View>
          <Text variant="caption" color="muted">
            {t('auth.register.coachHint')}
          </Text>
        </View>

        <View style={styles.names}>
          <View style={styles.name}>
            <Input
              label={t('auth.register.firstName')}
              value={firstName}
              onChangeText={(value) => {
                setFirstName(value);
                clear('firstName');
              }}
              error={fieldErrors.firstName ?? serverFieldError('firstName')}
              maxLength={50}
              autoComplete="given-name"
              textContentType="givenName"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => lastNameRef.current?.focus()}
            />
          </View>
          <View style={styles.name}>
            <Input
              label={t('auth.register.lastName')}
              value={lastName}
              onChangeText={(value) => {
                setLastName(value);
                clear('lastName');
              }}
              error={fieldErrors.lastName ?? serverFieldError('lastName')}
              inputRef={lastNameRef}
              maxLength={50}
              autoComplete="family-name"
              textContentType="familyName"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          </View>
        </View>

        <Input
          label={t('auth.register.email')}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            clear('email');
          }}
          error={fieldErrors.email ?? serverFieldError('email')}
          inputRef={emailRef}
          leading={<SymbolView name="envelope" {...iconProps} />}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          maxLength={100}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        <Input
          label={t('auth.register.password')}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            clear('password');
          }}
          error={fieldErrors.password ?? serverFieldError('password')}
          inputRef={passwordRef}
          leading={<SymbolView name="lock" {...iconProps} />}
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                passwordVisible ? t('auth.register.hidePassword') : t('auth.register.showPassword')
              }
              hitSlop={theme.spacing.xs}
              onPress={() => setPasswordVisible((visible) => !visible)}
            >
              <Text variant="label" color="muted">
                {passwordVisible ? t('auth.register.hidePassword') : t('auth.register.showPassword')}
              </Text>
            </Pressable>
          }
          secureTextEntry={!passwordVisible}
          maxLength={100}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <PasswordRules password={password} />

        <View style={styles.consents}>
          <Checkbox
            label={t('auth.register.gdprConsent')}
            checked={gdprConsent}
            onChange={(value) => {
              setGdprConsent(value);
              clear('gdpr');
            }}
            error={fieldErrors.gdpr}
          />
          {isClient ? (
            <Checkbox
              label={t('auth.register.healthConsent')}
              checked={healthConsent}
              onChange={(value) => {
                setHealthConsent(value);
                clear('health');
              }}
              error={fieldErrors.health}
            />
          ) : null}
        </View>

        {bannerKey ? (
          <Text variant="label" color="error" accessibilityRole="alert">
            {t(`auth.register.errors.${bannerKey}`)}
          </Text>
        ) : null}
        <Button
          label={t('auth.register.submit')}
          onPress={submit}
          disabled={mutation.isPending || mutation.isSuccess}
          style={styles.submit}
        />
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
      gap: theme.spacing.md,
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.sizes.authBottom,
    },
    topBar: {
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.xs,
    },
    header: {
      gap: theme.spacing.snug,
      paddingBottom: theme.spacing.xxs,
    },
    group: {
      gap: theme.spacing.snug,
    },
    roles: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    names: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    name: {
      flex: 1,
      minWidth: 0,
    },
    consents: {
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.xxs,
    },
    submit: {
      marginTop: theme.spacing.snug,
    },
  });
