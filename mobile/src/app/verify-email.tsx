import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { PROFILE_QUERY_KEY, ROLE_CLIENT, fetchProfile } from '@/api/profile';
import type { Profile } from '@/api/profile';
import {
  classifyAnonymousResendError,
  classifyResendError,
  classifyVerifyError,
  resendVerification,
  resendVerificationByEmail,
  verifyEmail,
} from '@/api/register';
import type { VerifiedAccount, VerifyFailure } from '@/api/register';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HeroIcon } from '@/components/HeroIcon';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { VerifiedNextSteps } from '@/components/VerifiedNextSteps';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const TOKEN_PATTERN = /^[0-9a-f]{64}$/i;
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const RESEND_COOLDOWN_SECONDS = 60;
const SECONDS_PER_MINUTE = 60;

type VerifyOutcome =
  | { kind: 'verified'; account: VerifiedAccount }
  | { kind: 'failed'; failure: VerifyFailure };

type ViewState =
  | { step: 'verifying' }
  | { step: 'confirmed'; account: VerifiedAccount; endsOtherSession: boolean }
  | { step: 'failed'; failure: VerifyFailure };

/** One request per token for the lifetime of the app, so remounts and StrictMode never repeat it. */
const verifications = new Map<string, Promise<VerifyOutcome>>();

function startVerification(token: string): Promise<VerifyOutcome> {
  const existing = verifications.get(token);
  if (existing) return existing;
  // Before the request: the first profile fetch can land between the server commit and our
  // response, and the phase must still end on Verified for a signed-in client.
  if (useAuthStore.getState().isAuthenticated) {
    useAuthStore.getState().markSawUnverified();
  }
  const pending = verifyEmail(token).then(
    (account): VerifyOutcome => ({ kind: 'verified', account }),
    (error: unknown): VerifyOutcome => ({ kind: 'failed', failure: classifyVerifyError(error) }),
  );
  verifications.set(token, pending);
  return pending;
}

/** Only a failure that never reached a verdict on the token may be retried. */
const isRetryable = (failure: VerifyFailure) => failure !== 'invalid' && failure !== 'expired';

const sameAddress = (left: string | undefined, right: string | undefined) =>
  left !== undefined && right !== undefined && left.trim().toLowerCase() === right.trim().toLowerCase();

const formatCountdown = (seconds: number): string => {
  const rest = seconds % SECONDS_PER_MINUTE;
  return `${Math.floor(seconds / SECONDS_PER_MINUTE)}:${rest < 10 ? '0' : ''}${rest}`;
};

/** Profile from the cache, or a fresh fetch; undefined when it cannot be loaded. */
async function loadProfile(queryClient: QueryClient, fresh: boolean): Promise<Profile | undefined> {
  const cached = queryClient.getQueryData<Profile>(PROFILE_QUERY_KEY);
  if (cached && !fresh) return cached;
  try {
    return await queryClient.fetchQuery({
      queryKey: PROFILE_QUERY_KEY,
      queryFn: ({ signal }) => fetchProfile(signal),
      staleTime: 0,
    });
  } catch {
    return undefined;
  }
}

/** Turns the shared outcome into what this screen shows, updating the session's profile when it applies. */
async function settle(outcome: VerifyOutcome, queryClient: QueryClient): Promise<ViewState> {
  const signedIn = useAuthStore.getState().isAuthenticated;

  if (outcome.kind === 'failed') {
    if (signedIn && outcome.failure === 'invalid') {
      const profile = await loadProfile(queryClient, true);
      // The link may have been used already, from this very account; the phase moves on.
      if (profile?.emailConfirmed) return { step: 'verifying' };
    }
    return { step: 'failed', failure: outcome.failure };
  }

  if (signedIn) {
    const profile = await loadProfile(queryClient, false);
    if (sameAddress(profile?.email, outcome.account.email)) {
      await queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
      return { step: 'verifying' };
    }
    return { step: 'confirmed', account: outcome.account, endsOtherSession: true };
  }
  return { step: 'confirmed', account: outcome.account, endsOtherSession: false };
}

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets);
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const tokenValid = TOKEN_PATTERN.test(token);
  const signedIn = useAuthStore((state) => state.isAuthenticated);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ViewState>({ step: 'verifying' });

  useEffect(() => {
    if (!tokenValid) return;
    let active = true;
    void startVerification(token)
      .then((outcome) => settle(outcome, queryClient))
      .then((next) => {
        if (active) setState(next);
      });
    return () => {
      active = false;
    };
  }, [token, tokenValid, attempt, queryClient]);

  const view: ViewState = tokenValid ? state : { step: 'failed', failure: 'invalid' };

  const retry = () => {
    verifications.delete(token);
    setState({ step: 'verifying' });
    setAttempt((current) => current + 1);
  };

  const leave = () => {
    if (signedIn) {
      void useAuthStore.getState().logout();
    } else {
      router.replace('/login');
    }
  };

  if (view.step === 'verifying') {
    return (
      <Screen contentStyle={styles.content}>
        <View style={styles.main}>
          <View style={styles.hero}>
            <ActivityIndicator color={theme.colors.ink2} size="large" />
            <Text variant="title" accessibilityRole="header" style={styles.centered}>
              {t('verifyLink.verifying')}
            </Text>
          </View>
        </View>
      </Screen>
    );
  }

  if (view.step === 'confirmed') {
    const { account, endsOtherSession } = view;
    const name = account.firstName?.trim();
    const goToSignIn = async () => {
      if (endsOtherSession) await useAuthStore.getState().logout();
      router.replace({ pathname: '/login', params: account.email ? { email: account.email } : {} });
    };

    return (
      <Screen contentStyle={styles.content}>
        <View style={styles.main}>
          <View style={styles.hero}>
            <HeroIcon symbol="checkmark" tone="success" />
            <Text variant="title" accessibilityRole="header" style={styles.centered}>
              {t('verified.title')}
            </Text>
            <Text variant="body" color="ink2" style={styles.centered}>
              {name ? t('verified.welcome', { name }) : t('verified.welcomeAnonymous')}
            </Text>
          </View>
          {account.roles.includes(ROLE_CLIENT) ? <VerifiedNextSteps /> : null}
        </View>
        <Button label={t('verifyLink.signIn')} onPress={() => void goToSignIn()} />
      </Screen>
    );
  }

  const { failure } = view;
  const backLabel = signedIn ? t('checkEmail.backSignOut') : t('verifyLink.backToSignIn');

  return (
    <Screen scroll contentStyle={styles.scrollContent}>
      <View style={styles.topBar}>
        <BackButton label={backLabel} onPress={leave} />
      </View>
      <View style={styles.main}>
        <View style={styles.hero}>
          <HeroIcon symbol="xmark" tone="error" />
          {failure === 'invalid' || failure === 'expired' ? (
            <>
              <Text variant="title" accessibilityRole="header" style={styles.centered}>
                {t(`verifyLink.${failure}.title`)}
              </Text>
              <Text variant="body" color="ink2" style={styles.centered}>
                {t(`verifyLink.${failure}.body`)}
              </Text>
            </>
          ) : (
            <>
              <Text variant="title" accessibilityRole="header" style={styles.centered}>
                {t('verifyLink.failed.title')}
              </Text>
              <Text variant="body" color="ink2" style={styles.centered}>
                {t(`verifyLink.failed.${failure}`)}
              </Text>
            </>
          )}
        </View>
        {isRetryable(failure) ? null : <ResendPanel signedIn={signedIn} />}
      </View>
      {isRetryable(failure) ? <Button label={t('verifyLink.retry')} onPress={retry} /> : null}
    </Screen>
  );
}

/** Asks for a fresh link: by session when signed in, by typed address otherwise. */
function ResendPanel({ signedIn }: { signedIn: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme, null);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [limitReached, setLimitReached] = useState(false);
  const [resent, setResent] = useState(false);
  const address = email.trim();

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const resend = useMutation({
    mutationFn: () => (signedIn ? resendVerification() : resendVerificationByEmail(address)),
    onSuccess: () => {
      setResent(true);
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    },
    onError: (error) => {
      if (!signedIn) return;
      const failure = classifyResendError(error);
      if (failure === 'limitReached') setLimitReached(true);
      if (failure === 'alreadyVerified') {
        void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
      }
    },
  });

  const failure = !resend.isError
    ? null
    : signedIn
      ? classifyResendError(resend.error)
      : classifyAnonymousResendError(resend.error);
  const errorKey = failure === 'alreadyVerified' ? null : limitReached ? 'limitReached' : failure;
  const emailMissing = !signedIn && !EMAIL_PATTERN.test(address);
  const resendBlocked = limitReached || resend.isPending || secondsLeft > 0 || emailMissing;

  return (
    <Card style={styles.help}>
      {signedIn ? null : (
        <Input
          label={t('verifyLink.emailLabel')}
          placeholder={t('verifyLink.emailPlaceholder')}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (resend.isError) resend.reset();
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={() => {
            if (!resendBlocked) resend.mutate();
          }}
        />
      )}
      <View style={styles.resendRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: resendBlocked }}
          disabled={resendBlocked}
          hitSlop={theme.spacing.xs}
          onPress={() => resend.mutate()}
        >
          <Text variant="labelStrong" color="muted" style={resendBlocked && styles.dimmed}>
            {t('verifyLink.resend')}
          </Text>
        </Pressable>
        {secondsLeft > 0 && !limitReached ? (
          <Text variant="label" color="muted">
            {t('verifyLink.resendIn', { time: formatCountdown(secondsLeft) })}
          </Text>
        ) : null}
      </View>
      {errorKey ? (
        <Text variant="label" color="error" accessibilityRole="alert">
          {t(`verifyLink.errors.${errorKey}`)}
        </Text>
      ) : resent && secondsLeft > 0 ? (
        <Text variant="label" color="success" accessibilityRole="alert">
          {signedIn ? t('verifyLink.resent') : t('verifyLink.resentAnonymous')}
        </Text>
      ) : null}
    </Card>
  );
}

const makeStyles = (theme: Theme, insets: EdgeInsets | null) =>
  StyleSheet.create({
    content: {
      flex: 1,
      paddingTop: (insets?.top ?? 0) + theme.spacing.safeAreaGap,
      paddingBottom: theme.sizes.authBottom,
    },
    scrollContent: {
      flexGrow: 1,
      paddingTop: (insets?.top ?? 0) + theme.spacing.safeAreaGap,
      paddingBottom: theme.sizes.authBottom,
    },
    topBar: {
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.xs,
    },
    main: {
      flex: 1,
      justifyContent: 'center',
      gap: theme.spacing.huge,
    },
    hero: {
      alignItems: 'center',
      gap: theme.spacing.lg,
    },
    centered: {
      textAlign: 'center',
    },
    help: {
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.xl,
    },
    resendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    dimmed: {
      opacity: theme.opacity.dimmed,
    },
  });
