import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { coachFullName, primaryRole } from '@/api/professionals';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { CoachAvatar } from '@/components/coach/CoachAvatar';
import { CoachRoleChip } from '@/components/coach/CoachRoleChip';
import { GlassButton } from '@/components/profile/GlassButton';
import { ListCard } from '@/components/profile/ListCard';
import { ListRow, RowIcon } from '@/components/profile/ListRow';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { SectionHeader } from '@/components/profile/SectionHeader';
import { Sparkline } from '@/components/profile/Sparkline';
import { StatsStrip } from '@/components/profile/StatsStrip';
import {
  countLabel,
  subtitleLabel,
  weightChangeLabel,
  weightLabel,
} from '@/components/profile/format';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useCollaborations } from '@/hooks/useCollaborations';
import { useProfile } from '@/hooks/useProfile';
import { useProfileSummary } from '@/hooks/useProfileSummary';
import { useWeightSeries } from '@/hooks/useWeightSeries';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** The client's own profile: headline numbers, their coaches and the progress entry points. */
export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const language = i18n.language;
  const { data: profile } = useProfile();
  const summaryQuery = useProfileSummary();
  const coachesQuery = useCollaborations();
  const summary = summaryQuery.data;
  const { data: weightSeries } = useWeightSeries();

  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');

  return (
    <Screen
      scroll
      gutter={theme.spacing.xl}
      topGap={theme.spacing.safeAreaGap}
      bottomInset={theme.spacing.huge}
      contentStyle={styles.content}
    >
      <View style={styles.topBar}>
        <BackButton label={t('onboarding.back')} onPress={() => router.back()} />
        {/* Edit profile is wired by its own screen; until then the button is shown, inert. */}
        <GlassButton label={t('profile.edit')}>
          <SymbolView name="pencil" tintColor={theme.colors.ink} size={theme.sizes.backIcon} />
        </GlassButton>
      </View>

      <ProfileHeader
        firstName={profile?.firstName}
        lastName={profile?.lastName}
        avatarBlobUrl={profile?.avatarBlobUrl}
        name={name}
        subtitle={summary ? subtitleLabel(t, language, summary.goal, summary.memberSince) : ''}
      />

      {summaryQuery.isPending ? (
        <View style={styles.state}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : summary ? (
        <StatsStrip
          stats={[
            { key: 'plans', value: countLabel(language, summary.planCount), label: t('profile.stats.plans') },
            {
              key: 'workouts',
              value: countLabel(language, summary.completedWorkoutCount),
              label: t('profile.stats.workouts'),
            },
            {
              key: 'sinceStart',
              value: weightChangeLabel(t, language, summary.weightChangeSinceStartKg),
              label: t('profile.stats.sinceStart'),
            },
          ]}
        />
      ) : (
        <SectionError
          message={t('profile.error.summary')}
          retryLabel={t('profile.error.retry')}
          onRetry={() => void summaryQuery.refetch()}
        />
      )}

      <View style={styles.section}>
        <SectionHeader title={t('profile.coaches.title')} />
        {coachesQuery.isPending ? (
          <View style={styles.state}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : coachesQuery.isError ? (
          <SectionError
            message={t('profile.error.coaches')}
            retryLabel={t('profile.error.retry')}
            onRetry={() => void coachesQuery.refetch()}
          />
        ) : coachesQuery.data.length === 0 ? (
          <ListCard>
            <View style={styles.empty}>
              <Text variant="body" color="muted">
                {t('profile.coaches.empty')}
              </Text>
            </View>
          </ListCard>
        ) : (
          <ListCard>
            {coachesQuery.data.map((coach) => {
              const role = primaryRole([coach.role ?? '']);
              const coachName = coach.professionalName ?? '';
              const [firstName = '', ...rest] = coachName.trim().split(/\s+/);
              const publicId = coach.professionalPublicId;
              return (
                <ListRow
                  key={coach.publicId ?? publicId ?? coachName}
                  leading={
                    <CoachAvatar
                      coach={{
                        firstName,
                        lastName: rest.join(' '),
                        avatarBlobUrl: coach.avatarBlobUrl,
                      }}
                      size={theme.sizes.profileCoachAvatar}
                      initialsVariant="captionStrong"
                    />
                  }
                  label={coachFullName({ firstName, lastName: rest.join(' ') })}
                  caption={role ? <CoachRoleChip role={role} size="sm" /> : undefined}
                  onPress={publicId ? () => router.push(`/coach/${publicId}`) : undefined}
                />
              );
            })}
          </ListCard>
        )}
      </View>

      {summary ? (
        <View style={styles.section}>
          <SectionHeader title={t('profile.progress.title')} />
          <ListCard>
            <ListRow
              leading={<RowIcon symbol="point.topleft.down.to.point.bottomright.curvepath" tone="accent" />}
              label={t('profile.progress.journey')}
              trailing={<Sparkline values={weightSeries ?? []} />}
            />
            <ListRow
              leading={<RowIcon symbol="ruler" tone="nutrition" />}
              label={t('profile.progress.measurements')}
              value={weightLabel(t, language, summary.latestWeightKg)}
            />
            <ListRow
              leading={<RowIcon symbol="photo" tone="training" />}
              label={t('profile.progress.photos')}
              value={countLabel(language, summary.progressPhotoCount)}
            />
            <ListRow
              leading={<RowIcon symbol="list.clipboard" tone="neutral" />}
              label={t('profile.progress.checkIns')}
              value={countLabel(language, summary.checkInCount)}
              onPress={() => router.push('/profile/check-ins')}
            />
          </ListCard>
        </View>
      ) : null}

      <ListCard>
        <ListRow
          leading={<RowIcon symbol="gearshape" tone="neutral" />}
          label={t('profile.settings')}
          onPress={() => router.push('/profile/settings')}
        />
      </ListCard>
    </Screen>
  );
}

function SectionError({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.error}>
      <Text variant="body" color="muted" style={styles.centered}>
        {message}
      </Text>
      <Button label={retryLabel} onPress={onRetry} />
    </View>
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
      justifyContent: 'space-between',
    },
    section: {
      gap: theme.spacing.snug,
    },
    state: {
      alignItems: 'center',
      paddingVertical: theme.spacing.xxl,
    },
    empty: {
      paddingVertical: theme.spacing.lg,
    },
    error: {
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xl,
    },
    centered: {
      textAlign: 'center',
    },
  });
