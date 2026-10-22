import { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { isAnswersUnavailable } from '@/api/onboardingAnswers';
import type { EditableAnswers } from '@/api/onboardingAnswers';
import type { Profile } from '@/api/profile';
import { Button } from '@/components/Button';
import { AvatarEditor } from '@/components/profile/edit/AvatarEditor';
import { InfoSection } from '@/components/profile/edit/InfoSection';
import { PersonalCard } from '@/components/profile/edit/PersonalCard';
import { ListCard } from '@/components/profile/ListCard';
import { SectionHeader } from '@/components/profile/SectionHeader';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAvatarActions } from '@/hooks/useAvatarActions';
import { useCollaborations } from '@/hooks/useCollaborations';
import { useEditProfile } from '@/hooks/useEditProfile';
import { useOnboardingAnswers } from '@/hooks/useOnboardingAnswers';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** Edit profile: photo, name and phone, and the sign-up answers under My info. */
export default function EditProfileScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const profileQuery = useProfile();
  const answersQuery = useOnboardingAnswers();

  // 404 and 409 mean there are no answers to edit; that hides My info but not the rest.
  const answersMissing = answersQuery.isError && isAnswersUnavailable(answersQuery.error);
  const profile = profileQuery.data;

  if (profile && (answersQuery.isSuccess || answersMissing)) {
    return <EditForm profile={profile} answers={answersQuery.data ?? null} />;
  }

  const failed = profileQuery.isError || answersQuery.isError;
  return (
    <Screen gutter={theme.spacing.xl} topGap={theme.spacing.safeAreaGap} contentStyle={styles.fill}>
      <ScreenHeader
        title={t('editProfile.title')}
        backLabel={t('onboarding.back')}
        onBack={() => router.back()}
      />
      <View style={styles.state}>
        {failed ? (
          <>
            <Text variant="body" color="muted" style={styles.centered}>
              {t('editProfile.error.load')}
            </Text>
            <Button
              label={t('profile.error.retry')}
              onPress={() => {
                void profileQuery.refetch();
                void answersQuery.refetch();
              }}
            />
          </>
        ) : (
          <ActivityIndicator color={theme.colors.accent} />
        )}
      </View>
    </Screen>
  );
}

function EditForm({ profile, answers }: { profile: Profile; answers: EditableAnswers | null }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets);
  const router = useRouter();
  const navigation = useNavigation();
  const form = useEditProfile(profile, answers);
  const avatar = useAvatarActions();
  const coachesQuery = useCollaborations();

  // Everything saved: leave. The guard below is already off by the time this effect runs.
  useEffect(() => {
    if (form.saved) router.back();
  }, [form.saved, router]);

  usePreventRemove(form.dirty && !form.saved, ({ data }) => {
    Alert.alert(t('editProfile.discard.title'), t('editProfile.discard.body'), [
      { text: t('editProfile.discard.keep'), style: 'cancel' },
      {
        text: t('editProfile.discard.discard'),
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  const coachNames = (coachesQuery.data ?? []).flatMap((coach) => {
    const first = coach.professionalName?.trim().split(/\s+/)[0];
    return first ? [first] : [];
  });
  const coachList =
    coachNames.length > 1
      ? `${coachNames.slice(0, -1).join(', ')} ${t('editProfile.and')} ${coachNames[coachNames.length - 1]}`
      : (coachNames[0] ?? '');

  const problemText = form.problem
    ? form.problem.partial
      ? t('editProfile.errors.partial')
      : t(`editProfile.errors.save.${form.problem.failure}`)
    : null;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        scroll
        gutter={theme.spacing.xl}
        topGap={theme.spacing.safeAreaGap}
        bottomInset={theme.spacing.xxl}
        contentStyle={styles.content}
      >
        <ScreenHeader
          title={t('editProfile.title')}
          backLabel={t('onboarding.back')}
          onBack={() => router.back()}
        />

        <AvatarEditor
          firstName={profile.firstName}
          lastName={profile.lastName}
          avatarBlobUrl={profile.avatarBlobUrl}
          busy={avatar.isPending}
          failure={avatar.failure}
          onChange={avatar.change}
          onRemove={avatar.remove}
        />

        <PersonalCard
          personal={form.personal}
          errors={form.personalErrors}
          serverFlagged={form.serverFlagged}
          onChange={form.setPersonalField}
        />

        <View style={styles.group}>
          <SectionHeader title={t('editProfile.signIn')} />
          <ListCard>
            <View style={styles.email}>
              <Text variant="label" color="muted">
                {t('editProfile.email')}
              </Text>
              <Text variant="body">{profile.email ?? ''}</Text>
            </View>
          </ListCard>
          <Text variant="caption" color="muted" style={styles.hint}>
            {t('editProfile.signInHint')}
          </Text>
        </View>

        {form.answers ? (
          <InfoSection answers={form.answers} errors={form.answerErrors} onChange={form.setAnswer} />
        ) : null}

        {form.answers && coachNames.length > 0 ? (
          <Text variant="label" color="muted" style={styles.hint}>
            {t('editProfile.coachesNote', { count: coachNames.length, names: coachList })}
          </Text>
        ) : null}
      </Screen>

      <View style={styles.footer}>
        <Button
          label={t('editProfile.save')}
          onPress={form.save}
          disabled={!form.dirty || !form.valid || form.isSaving}
        />
        {problemText ? (
          <Text variant="label" color="error" accessibilityRole="alert" style={styles.centered}>
            {problemText}
          </Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme: Theme, insets?: EdgeInsets) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.ground,
    },
    fill: {
      flex: 1,
    },
    content: {
      gap: theme.spacing.xxl,
    },
    group: {
      gap: theme.spacing.snug,
    },
    email: {
      gap: theme.spacing.xxs,
      paddingVertical: theme.spacing.md,
    },
    hint: {
      paddingHorizontal: theme.spacing.xxs,
    },
    state: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.md,
    },
    centered: {
      textAlign: 'center',
    },
    footer: {
      gap: theme.spacing.xs,
      paddingTop: theme.spacing.md,
      paddingBottom: Math.max(insets?.bottom ?? 0, theme.spacing.xl),
      paddingLeft: (insets?.left ?? 0) + theme.spacing.xl,
      paddingRight: (insets?.right ?? 0) + theme.spacing.xl,
      backgroundColor: theme.colors.ground,
    },
  });
