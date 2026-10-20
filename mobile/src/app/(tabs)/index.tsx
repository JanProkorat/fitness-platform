import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { FindCoachSection } from '@/components/today/FindCoachSection';
import type { CoachRole } from '@/components/today/FindCoachSection';
import { InvitesSection } from '@/components/today/InvitesSection';
import { TodayHeader } from '@/components/today/TodayHeader';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const COACH_ROLES: CoachRole[] = ['Trainer', 'Nutritionist'];

export default function TodayScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { data: profile } = useProfile();
  const barClearance = theme.sizes.tabBar + theme.sizes.tabBarBottom + theme.spacing.xxl;

  if (!profile) {
    return <Screen>{null}</Screen>;
  }

  const linked = profile.linkedRoles ?? [];
  const missingRoles = COACH_ROLES.filter((role) => !linked.includes(role));
  const noCoach = !profile.hasActiveLink && linked.length === 0;
  const name = profile.firstName?.trim();

  const eyebrow = noCoach ? t('today.eyebrow') : '';
  const title = noCoach
    ? name
      ? t('today.greeting', { name })
      : t('today.greetingAnonymous')
    : name
      ? t('today.linkedGreeting', { name })
      : t('today.linkedGreetingAnonymous');

  return (
    <Screen scroll bottomInset={barClearance} contentStyle={styles.content}>
      <TodayHeader eyebrow={eyebrow} title={title} />
      {missingRoles.length > 0 ? (
        <FindCoachSection roles={missingRoles} />
      ) : (
        <Text variant="bodyLarge" color="muted">
          {t('today.linkedBody')}
        </Text>
      )}
      <InvitesSection />
    </Screen>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.huge,
      paddingTop: theme.spacing.xxl,
    },
  });
