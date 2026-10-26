import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { CoachSection, coachHeading, hasPayments } from '@/components/payments/CoachSection';
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

  const withPayments = (coaches ?? []).filter(hasPayments);
  // One coach: the bar carries "COACH · package" and the list drops that coach's heading.
  const soleCoach = withPayments.length === 1 ? withPayments[0] : undefined;

  return (
    <View style={styles.root}>
      <Screen
        scroll
        topGap={theme.sizes.backButton + theme.spacing.lg}
        bottomInset={theme.spacing.huge}
        contentStyle={styles.content}
      >
        {isPending ? <ActivityIndicator color={theme.colors.muted} style={styles.loading} /> : null}
        {isError && !coaches ? (
          <Pressable accessibilityRole="button" onPress={() => void refetch()}>
            <Text variant="body" color="muted">
              {t('payments.error')}
            </Text>
          </Pressable>
        ) : null}
        {coaches && withPayments.length === 0 ? (
          <Text variant="body" color="muted">
            {t('payments.empty')}
          </Text>
        ) : null}
        {withPayments.map((coach) => (
          <CoachSection key={coach.coachId} coach={coach} showHeading={coach !== soleCoach} />
        ))}
      </Screen>
      <View style={styles.bar} pointerEvents="box-none">
        <View style={styles.slot}>
          <BackButton label={t('payments.back')} onPress={leave} />
        </View>
        <View style={styles.titleBlock}>
          <Text variant="barTitle" numberOfLines={1} accessibilityRole="header" style={styles.centered}>
            {t('payments.title')}
          </Text>
          {soleCoach ? (
            <Text variant="barSubtitle" color="muted" numberOfLines={1} style={styles.centered}>
              {coachHeading(soleCoach)}
            </Text>
          ) : null}
        </View>
        <View style={styles.slot} />
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
    bar: {
      position: 'absolute',
      top: insets.top + theme.spacing.safeAreaGap,
      left: theme.spacing.xxl,
      right: theme.spacing.xxl,
      height: theme.sizes.backButton,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    slot: {
      width: theme.sizes.barSlot,
      flexDirection: 'row',
    },
    titleBlock: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      gap: theme.spacing.hair,
    },
    centered: {
      maxWidth: '100%',
      textAlign: 'center',
    },
  });
