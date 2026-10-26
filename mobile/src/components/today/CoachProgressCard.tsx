import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { Collaboration } from '@/api/collaborations';
import type { Conversation } from '@/api/conversations';
import type { PendingItems, SubmittedByCoach } from '@/api/questionnaires';
import { Chip } from '@/components/Chip';
import { firstName, initials } from '@/components/invites/format';
import { Text } from '@/components/Text';
import { useConversations } from '@/hooks/useConversations';
import { usePendingQuestionnaires } from '@/hooks/usePendingQuestionnaires';
import { useSubmittedQuestionnaires } from '@/hooks/useSubmittedQuestionnaires';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import type { CoachRole } from './collaborationRoles';
import { roleLook } from './roleLook';
import { TimelineStep } from './TimelineStep';
import type { StepState } from './TimelineStep';
import { sinceLabel } from './todayFormat';

type CoachProgressCardProps = {
  collaboration: Collaboration;
  /** Every role the collaboration covers; one pill each. */
  covered: CoachRole[];
  /** The covered roles that still have no published plan; one in-progress step each. */
  unpublished: CoachRole[];
  /** True when the client has exactly one covering collaboration, so an unmatched photo request is theirs. */
  onlyCollaboration: boolean;
};

type Step = {
  key: string;
  state: StepState;
  title: string;
  hint?: string;
  currentColor?: string;
  actionLabel?: string;
  onAction?: () => void;
};

const normalize = (name: string | undefined): string => (name ?? '').trim().toLowerCase();

/** The chat with this coach, matched by participant id first and display name second. */
function findConversation(
  conversations: readonly Conversation[] | undefined,
  collaboration: Collaboration,
): Conversation | undefined {
  const live = (conversations ?? []).filter((conversation) => !conversation.isFormer);
  const byId = live.find(
    (conversation) =>
      conversation.participant?.id !== undefined &&
      conversation.participant.id === collaboration.professionalPublicId,
  );
  if (byId) return byId;
  const name = normalize(collaboration.professionalName);
  return name === '' ? undefined : live.find((c) => normalize(c.participant?.name) === name);
}

const hasPendingQuestionnaire = (pending: PendingItems | undefined, linkId: string | undefined): boolean =>
  linkId !== undefined && (pending?.questionnaires ?? []).some((item) => item.linkPublicId === linkId);

const hasSubmittedQuestionnaire = (
  submitted: readonly SubmittedByCoach[] | undefined,
  linkId: string | undefined,
): boolean =>
  linkId !== undefined &&
  (submitted ?? []).some(
    (coach) => coach.linkPublicId === linkId && (coach.responses ?? []).length > 0,
  );

const hasPhotoRequest = (
  pending: PendingItems | undefined,
  collaboration: Collaboration,
  onlyCollaboration: boolean,
): boolean => {
  const requests = pending?.diaryRequests ?? [];
  const name = normalize(collaboration.professionalName);
  if (requests.some((request) => normalize(request.professionalName) === name)) return true;
  return onlyCollaboration && requests.length > 0;
};

/** One coach who is still building a plan: who they are, what is done, what is waiting on the client. */
export function CoachProgressCard({
  collaboration,
  covered,
  unpublished,
  onlyCollaboration,
}: CoachProgressCardProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { data: pending } = usePendingQuestionnaires();
  const { data: submitted } = useSubmittedQuestionnaires();
  const { data: conversations } = useConversations();

  const fullName = collaboration.professionalName?.trim() ?? '';
  const first = firstName(fullName) || t('today.progress.coachFallback');
  const single = covered.length === 1;
  const questionnairePending = hasPendingQuestionnaire(pending, collaboration.publicId);
  const questionnaireSent = !questionnairePending && hasSubmittedQuestionnaire(submitted, collaboration.publicId);
  const photoRequested = hasPhotoRequest(pending, collaboration, onlyCollaboration);
  const waiting = (questionnairePending ? 1 : 0) + (photoRequested ? 1 : 0);

  const openChat = () => {
    const target = findConversation(conversations, collaboration);
    if (target?.id) router.push({ pathname: '/chat/[id]', params: { id: target.id } });
    else router.push('/messages');
  };

  const steps: Step[] = [{ key: 'accepted', state: 'done', title: t('today.progress.accepted') }];
  if (questionnairePending) {
    steps.push({
      key: 'questionnaire',
      state: 'open',
      title: t('today.progress.questionnairePending'),
      hint: t('today.progress.questionnairePendingHint'),
    });
  } else if (questionnaireSent) {
    steps.push({ key: 'questionnaire', state: 'done', title: t('today.progress.questionnaireSent') });
  }
  if (photoRequested) {
    steps.push({
      key: 'photos',
      state: 'open',
      title: t('today.progress.photos'),
      hint: t('today.progress.photosHint', { name: first }),
      actionLabel: t('today.progress.photosAdd'),
      onAction: () => router.push('/profile/photos'),
    });
  }
  for (const role of unpublished) {
    const look = roleLook(theme, role);
    steps.push({
      key: `plan-${role}`,
      state: 'current',
      currentColor: look.ink,
      title: single ? t('today.progress.planSingle') : t(`today.progress.plan.${role}`),
      hint: single
        ? t('today.progress.planSingleHint')
        : t(role === 'Trainer' ? 'today.findCoach.trainer.hint' : 'today.findCoach.nutritionist.hint'),
    });
  }

  const headlineKey = unpublished.length > 1 ? 'both' : (unpublished[0] ?? 'Trainer');
  const tellKey = covered.length > 1 ? 'both' : (covered[0] ?? 'Trainer');
  const since = sinceLabel(t, i18n.language, collaboration.since);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text variant="bodyStrong" style={{ color: theme.colors.onAvatar }}>
            {initials(fullName)}
          </Text>
        </View>
        <View style={styles.who}>
          <Text variant="subtitle" numberOfLines={1}>
            {fullName || first}
          </Text>
          <View style={styles.meta}>
            {covered.map((role) => (
              <Chip
                key={role}
                size="sm"
                variant={role === 'Trainer' ? 'training' : 'nutrition'}
                label={t(`invites.roles.${role}`)}
              />
            ))}
            {since ? (
              <Text variant="caption" color="muted">
                {since}
              </Text>
            ) : null}
          </View>
        </View>
        {waiting > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('today.progress.messageLabel')}
            onPress={openChat}
            style={styles.iconButton}
          >
            <SymbolView name="bubble.left" tintColor={theme.colors.ink} size={theme.sizes.bellGlyph} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.headline}>
        <Text variant="heading" accessibilityRole="header">
          {t(`today.progress.headline.${headlineKey}`, { name: first })}
        </Text>
        {waiting > 0 ? (
          <Text variant="label" color="muted">
            {t('today.progress.things', { count: waiting })}
          </Text>
        ) : null}
      </View>
      <View>
        {steps.map((step, index) => {
          const next = steps[index + 1];
          const connector = next ? (step.state === 'done' && next.state === 'done' ? 'done' : 'idle') : null;
          return (
            <TimelineStep
              key={step.key}
              state={step.state}
              title={step.title}
              hint={step.hint}
              currentColor={step.currentColor}
              actionLabel={step.actionLabel}
              onAction={step.onAction}
              connector={connector}
            />
          );
        })}
      </View>
      {covered.length > 1 ? (
        <Text variant="caption" color="muted">
          {t(unpublished.length > 1 ? 'today.progress.footnoteBoth' : 'today.progress.footnoteOne')}
        </Text>
      ) : null}
      {waiting === 0 ? (
        <>
          <View style={styles.tell}>
            <Text variant="labelStrong">{t('today.progress.tell.title')}</Text>
            <Text variant="caption" color="muted">
              {t(`today.progress.tell.${tellKey}`)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('today.progress.message', { name: first })}
            onPress={openChat}
            style={styles.message}
          >
            <SymbolView name="bubble.left" tintColor={theme.colors.onPrimary} size={theme.sizes.rowGlyph} />
            <Text variant="button" color="onPrimary">
              {t('today.progress.message', { name: first })}
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      gap: theme.spacing.xl,
      padding: theme.spacing.roomy,
      borderRadius: theme.radii.card,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    avatar: {
      width: theme.sizes.progressAvatar,
      height: theme.sizes.progressAvatar,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.avatar,
    },
    who: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: theme.spacing.snug,
      rowGap: theme.spacing.xxs,
    },
    iconButton: {
      width: theme.sizes.messageButton,
      height: theme.sizes.messageButton,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
    },
    headline: {
      gap: theme.spacing.xxs / 2,
    },
    tell: {
      gap: theme.spacing.xxs,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.subtle,
    },
    message: {
      height: theme.sizes.buttonMedium,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.primary,
    },
  });
