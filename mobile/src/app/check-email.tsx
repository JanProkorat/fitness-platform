import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { PROFILE_QUERY_KEY } from '@/api/profile';
import { classifyResendError, resendVerification } from '@/api/register';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HeroIcon } from '@/components/HeroIcon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useProfile } from '@/hooks/useProfile';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const POLL_INTERVAL_MS = 5000;
const RESEND_COOLDOWN_SECONDS = 60;
const SECONDS_PER_MINUTE = 60;
const EMAIL_APP_URL = Platform.select({ ios: 'message://', default: 'mailto:' });

const formatCountdown = (seconds: number): string => {
  const rest = seconds % SECONDS_PER_MINUTE;
  return `${Math.floor(seconds / SECONDS_PER_MINUTE)}:${rest < 10 ? '0' : ''}${rest}`;
};

export default function CheckEmailScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets);
  const queryClient = useQueryClient();
  const focused = useIsFocused();
  const { data: profile } = useProfile({ refetchInterval: focused ? POLL_INTERVAL_MS : false });
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  const [limitReached, setLimitReached] = useState(false);
  const [resent, setResent] = useState(false);
  const [emailAppUnavailable, setEmailAppUnavailable] = useState(false);

  useEffect(() => {
    useAuthStore.getState().markSawUnverified();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const resend = useMutation({
    mutationFn: resendVerification,
    onSuccess: () => {
      setResent(true);
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    },
    onError: (error) => {
      const failure = classifyResendError(error);
      if (failure === 'limitReached') setLimitReached(true);
      if (failure === 'alreadyVerified') {
        void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
      }
    },
  });

  const resendFailure = resend.isError ? classifyResendError(resend.error) : null;
  const resendBlocked = limitReached || resend.isPending || secondsLeft > 0;

  const openEmailApp = useCallback(async () => {
    try {
      await Linking.openURL(EMAIL_APP_URL);
    } catch {
      setEmailAppUnavailable(true);
    }
  }, []);

  const errorKey =
    resendFailure === 'alreadyVerified' ? null : limitReached ? 'limitReached' : resendFailure;

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.topBar}>
        <BackButton
          label={t('checkEmail.backSignOut')}
          onPress={() => void useAuthStore.getState().logout()}
        />
      </View>
      <View style={styles.main}>
        <View style={styles.hero}>
          <HeroIcon symbol="envelope" tone="accent" />
          <Text variant="title" accessibilityRole="header" style={styles.centered}>
            {t('checkEmail.title')}
          </Text>
          <Text variant="body" color="ink2" style={styles.centered}>
            {t('checkEmail.sentTo')}
            {'\n'}
            <Text variant="bodyStrong">{profile?.email ?? ''}</Text>
            {'\n'}
            {t('checkEmail.tapIt')}
          </Text>
        </View>
        <Card style={styles.help}>
          <Text variant="bodyStrong">{t('checkEmail.noEmailTitle')}</Text>
          <Text variant="label" color="muted" style={styles.helpBody}>
            {t('checkEmail.noEmailBody')}
          </Text>
          <View style={styles.resendRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: resendBlocked }}
              disabled={resendBlocked}
              hitSlop={theme.spacing.xs}
              onPress={() => resend.mutate()}
            >
              <Text variant="labelStrong" color="muted" style={resendBlocked && styles.dimmed}>
                {t('checkEmail.resend')}
              </Text>
            </Pressable>
            {secondsLeft > 0 && !limitReached ? (
              <Text variant="label" color="muted">
                {t('checkEmail.resendIn', { time: formatCountdown(secondsLeft) })}
              </Text>
            ) : null}
          </View>
          {errorKey ? (
            <Text variant="label" color="error" accessibilityRole="alert">
              {t(`checkEmail.errors.${errorKey}`)}
            </Text>
          ) : resent && secondsLeft > 0 ? (
            <Text variant="label" color="success" accessibilityRole="alert">
              {t('checkEmail.resent')}
            </Text>
          ) : null}
        </Card>
      </View>
      {emailAppUnavailable ? null : (
        <Button label={t('checkEmail.openEmailApp')} onPress={() => void openEmailApp()} />
      )}
    </Screen>
  );
}

const makeStyles = (theme: Theme, insets: EdgeInsets) =>
  StyleSheet.create({
    content: {
      flex: 1,
      paddingTop: insets.top + theme.spacing.xs,
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
      gap: theme.spacing.xxs,
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.xl,
    },
    helpBody: {
      lineHeight: theme.typography.body.lineHeight,
    },
    resendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingTop: theme.spacing.snug,
    },
    dimmed: {
      opacity: 0.7,
    },
  });
