import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { CoachSection } from '@/components/payments/CoachSection';
import { usePayments } from '@/hooks/usePayments';
import { usePaymentsEnabled } from '@/hooks/usePaymentsEnabled';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** What the client owes and has paid, per coach, with the QR code and transfer details to pay. */
export default function PaymentsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets);
  const { enabled, settled } = usePaymentsEnabled();
  const { data: coaches, isPending, isError, refetch } = usePayments(enabled);

  // Deep links and push taps can land here with payments switched off: leave instead of showing anything.
  useEffect(() => {
    if (settled && !enabled) router.replace('/');
  }, [settled, enabled, router]);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (!enabled) {
    return <View style={styles.blank} />;
  }

  const hasPayments = (coaches ?? []).some(
    (coach) => (coach.requested?.length ?? 0) > 0 || (coach.paid?.length ?? 0) > 0,
  );

  return (
    <View style={styles.root}>
      <Screen
        scroll
        topGap={theme.sizes.backButton + theme.spacing.xl}
        bottomInset={theme.spacing.huge}
        contentStyle={styles.content}
      >
        <Text variant="title" accessibilityRole="header">
          {t('payments.title')}
        </Text>
        {isPending ? <ActivityIndicator color={theme.colors.muted} style={styles.loading} /> : null}
        {isError && !coaches ? (
          <Pressable accessibilityRole="button" onPress={() => void refetch()}>
            <Text variant="body" color="muted">
              {t('payments.error')}
            </Text>
          </Pressable>
        ) : null}
        {coaches && !hasPayments ? (
          <Text variant="body" color="muted">
            {t('payments.empty')}
          </Text>
        ) : null}
        {coaches?.map((coach) => <CoachSection key={coach.coachId} coach={coach} />)}
      </Screen>
      <View style={styles.back}>
        <BackButton label={t('payments.back')} onPress={leave} />
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme, insets: EdgeInsets) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.ground,
    },
    blank: {
      flex: 1,
      backgroundColor: theme.colors.ground,
    },
    content: {
      gap: theme.spacing.xxxl,
    },
    loading: {
      alignSelf: 'flex-start',
    },
    back: {
      position: 'absolute',
      top: insets.top + theme.spacing.safeAreaGap,
      left: theme.spacing.xxl,
    },
  });
