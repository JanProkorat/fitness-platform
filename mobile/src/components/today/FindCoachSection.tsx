import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { CoachCard } from './CoachCard';

export type CoachRole = 'Trainer' | 'Nutritionist';

type FindCoachSectionProps = {
  /** Roles still without a linked coach; one card each. */
  roles: CoachRole[];
};

/** The "find a coach" block: one card per role the client has no coach for yet. */
export function FindCoachSection({ roles }: FindCoachSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const open = (role: CoachRole) =>
    router.push({ pathname: '/coach-search', params: { role } });

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text variant="overline" color="muted" style={styles.overline}>
          {t('today.findCoach.title').toUpperCase()}
        </Text>
        <Text variant="bodyLarge" color="muted">
          {t('today.findCoach.subtitle')}
        </Text>
      </View>
      <View style={styles.cards}>
        {roles.includes('Trainer') ? (
          <CoachCard
            title={t('today.findCoach.trainer.title')}
            hint={t('today.findCoach.trainer.hint')}
            symbol="dumbbell"
            tone="training"
            onPress={() => open('Trainer')}
          />
        ) : null}
        {roles.includes('Nutritionist') ? (
          <CoachCard
            title={t('today.findCoach.nutritionist.title')}
            hint={t('today.findCoach.nutritionist.hint')}
            symbol="leaf"
            tone="nutrition"
            onPress={() => open('Nutritionist')}
          />
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    section: {
      gap: theme.spacing.xl,
    },
    heading: {
      gap: theme.spacing.xxs,
    },
    overline: {
      letterSpacing: theme.typography.overline.letterSpacing,
    },
    cards: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
  });
