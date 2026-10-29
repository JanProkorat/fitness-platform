import type { ReactNode } from 'react';
import { RefreshControl, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/Screen';
import { TabFade } from '@/components/TabFade';
import { Text } from '@/components/Text';
import { AreaBlocks, hasAreaBlock } from '@/components/today/AreaBlocks';
import { CoachProgressCard } from '@/components/today/CoachProgressCard';
import {
  COACH_ROLES,
  coveredCollaborations,
  offeredInvites,
  roleForPlanKind,
} from '@/components/today/collaborationRoles';
import type { CoachRole } from '@/components/today/collaborationRoles';
import { FindCoachSection } from '@/components/today/FindCoachSection';
import { HowItWorks } from '@/components/today/HowItWorks';
import { InvitesSection } from '@/components/today/InvitesSection';
import { PaymentDueCard } from '@/components/today/PaymentDueCard';
import { RoleSlots } from '@/components/today/RoleSlots';
import { StartOnYourOwn } from '@/components/today/StartOnYourOwn';
import { selectAreaBlocks } from '@/components/today/todayBlocks';
import { TodayHeader } from '@/components/today/TodayHeader';
import { isActivePlan, planKind } from '@/api/plans';
import { useClientPlans } from '@/hooks/useClientPlans';
import { useCollaborations } from '@/hooks/useCollaborations';
import { useInvites } from '@/hooks/useInvites';
import { useLocalDayChange } from '@/hooks/useLocalDayChange';
import { useProfile } from '@/hooks/useProfile';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const unique =<T,>(values: readonly T[]): T[] => Array.from(new Set(values));

export default function TodayScreen() {
  return (
    <TabFade>
      <TodayContent />
    </TabFade>
  );
}

function TodayContent() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { data: profile } = useProfile();
  const collaborations = useCollaborations();
  const invites = useInvites();
  const plans = useClientPlans();
  const today = useLocalDayChange();
  const { refreshing, onRefresh } = usePullToRefresh();
  const barClearance = theme.sizes.tabBar + theme.sizes.tabBarBottom + theme.spacing.xxl;

  if (!profile) {
    return <Screen>{null}</Screen>;
  }

  const name = profile.firstName?.trim();
  const greeting = name ? t('today.greeting', { name }) : t('today.greetingAnonymous');
  const screen = (header: ReactNode, content: ReactNode, tight = false) => (
    <Screen
      scroll
      collapseTabBar
      header={header}
      topGap={theme.spacing.safeAreaGap}
      bottomInset={barClearance}
      contentStyle={tight ? styles.contentTight : styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.muted}
          colors={[theme.colors.muted]}
        />
      }
    >
      {content}
    </Screen>
  );

  // A failed collaborations lookup falls back to what the profile says, as before.
  const covering = collaborations.isError ? null : coveredCollaborations(collaborations.data ?? []);

  if (covering !== null) {
    const waitingForData =
      collaborations.isPending || invites.isPending || (covering.length > 0 && plans.isPending);
    if (waitingForData) {
      return screen(<TodayHeader title={greeting} />, null);
    }

    const coveredRoles = unique(covering.flatMap((entry) => entry.roles));
    const missing: CoachRole[] = COACH_ROLES.filter((role) => !coveredRoles.includes(role));
    const offers = offeredInvites(invites.data ?? [], missing);

    if (covering.length === 0) {
      return screen(
        <TodayHeader title={greeting} />,
        <>
          {offers.length > 0 ? (
            <RoleSlots missing={missing} offers={offers} mode="find" showHeading />
          ) : (
            <FindCoachSection roles={missing} />
          )}
          <HowItWorks />
          <StartOnYourOwn />
        </>,
      );
    }

    if (!plans.isError) {
      const areaBlocks = selectAreaBlocks(plans.data ?? [], covering, today);
      // Once any area has an Active plan, each area gets its own block instead of the progress card.
      if (areaBlocks !== null && areaBlocks.some(hasAreaBlock)) {
        return screen(
          <TodayHeader title={t('today.dateTitle')} />,
          <AreaBlocks blocks={areaBlocks} today={today} />,
          true,
        );
      }
    }

    if (!plans.isError && !(plans.data ?? []).some(isActivePlan)) {
      const published = unique(
        (plans.data ?? []).filter(isActivePlan).map((plan) => roleForPlanKind(planKind(plan))),
      );
      const progress = covering
        .map((entry) => ({
          ...entry,
          unpublished: entry.roles.filter((role) => !published.includes(role)),
        }))
        .filter((entry) => entry.unpublished.length > 0);

      if (progress.length > 0) {
        const hasPublished = coveredRoles.some((role) => published.includes(role));
        return screen(
          <TodayHeader title={t('today.dateTitle')} />,
          <>
            {progress.map((entry) => (
              <CoachProgressCard
                key={entry.collaboration.publicId ?? entry.collaboration.professionalPublicId}
                collaboration={entry.collaboration}
                covered={entry.roles}
                unpublished={entry.unpublished}
                onlyCollaboration={covering.length === 1}
              />
            ))}
            {hasPublished ? (
              <Text variant="bodyLarge" color="muted">
                {t('today.linkedBody')}
              </Text>
            ) : null}
            {missing.length > 0 ? (
              <RoleSlots missing={missing} offers={offers} mode="add" />
            ) : null}
            <StartOnYourOwn showHeading={false} />
          </>,
          true,
        );
      }
    }
  }

  const linked = profile.linkedRoles ?? [];
  const missingRoles = COACH_ROLES.filter((role) => !linked.includes(role));
  const noCoach = !profile.hasActiveLink && linked.length === 0;
  const title = noCoach
    ? greeting
    : name
      ? t('today.linkedGreeting', { name })
      : t('today.linkedGreetingAnonymous');

  return screen(
    <TodayHeader title={title} />,
    <>
      {missingRoles.length > 0 ? (
        <FindCoachSection roles={missingRoles} />
      ) : (
        <Text variant="bodyLarge" color="muted">
          {t('today.linkedBody')}
        </Text>
      )}
      <PaymentDueCard />
      <InvitesSection />
    </>,
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.huge,
    },
    contentTight: {
      gap: theme.spacing.xl,
    },
  });
