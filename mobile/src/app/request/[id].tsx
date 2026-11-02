import { useRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { hasOpenProposal } from '@/api/clientRequests';
import { BackButton } from '@/components/BackButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Text } from '@/components/Text';
import { InviteActions } from '@/components/invites/InviteActions';
import { InviteAvatar } from '@/components/invites/InviteAvatar';
import { RoleChip } from '@/components/invites/RoleChip';
import { firstName, relativeTime } from '@/components/invites/format';
import { ProposalPackageCard } from '@/components/requests/ProposalPackageCard';
import { useCoachProfile } from '@/hooks/useCoachProfile';
import { useMyClientRequests } from '@/hooks/useMyClientRequests';
import { usePaymentsEnabled } from '@/hooks/usePaymentsEnabled';
import { useRequestProposal } from '@/hooks/useRequestProposal';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** A coach's package proposal on the client's request: the package, the coach's note, Accept package and Decline. */
export default function RequestProposalScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets);
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const requests = useMyClientRequests();
  const request = requests.data?.find((candidate) => candidate.publicId?.toLowerCase() === id.toLowerCase());
  const coach = useCoachProfile(request?.professionalPublicId ?? '');
  const { enabled: paymentsEnabled } = usePaymentsEnabled();
  const left = useRef(false);
  // Both the action callback and the back button can fire; leave exactly once.
  const leave = () => {
    if (left.current) return;
    left.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const { accept, decline, busy } = useRequestProposal({ onSettled: leave });

  const proposal = request?.proposal;
  const open = hasOpenProposal(request) && proposal !== undefined;

  if (requests.isPending) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  // Withdrawn, answered or unknown: there is nothing to answer, and a withdrawal can arrive while the screen is open.
  if (!open || !proposal || !request) {
    return (
      <View style={styles.root}>
        <View style={styles.stateBack}>
          <BackButton label={t('requestProposal.back')} onPress={leave} />
        </View>
        <OfflineBanner />
        <View style={styles.state}>
          <Text variant="heading" accessibilityRole="header" style={styles.centeredText}>
            {t('requestProposal.closed.title')}
          </Text>
          <Text variant="body" color="muted" style={styles.centeredText}>
            {t('requestProposal.closed.body')}
          </Text>
        </View>
      </View>
    );
  }

  const name = request.professionalName ?? '';
  const first = firstName(name);
  const profile = coach.data;
  const roleLabel = (profile?.roles ?? []).join(' & ');
  const avatarUrl = profile?.avatarBlobUrl?.startsWith('http') ? profile.avatarBlobUrl : undefined;
  const pack = proposal.package;
  const description = profile?.packages
    ?.find((candidate) => candidate.publicId === pack?.publicId)
    ?.description?.trim();
  const questionnaireTitle = proposal.questionnaireTitle?.trim();
  const statement = proposal.statement?.trim();

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.heroImage} contentFit="cover" /> : null}
        </View>
        <View style={styles.sheet}>
          <View style={styles.nameRow}>
            <Text variant="title" style={styles.name} accessibilityRole="header">
              {name}
            </Text>
            <RoleChip coachRole={roleLabel} />
          </View>
          <OfflineBanner />
          {profile?.city || profile?.online ? (
            <View style={styles.location}>
              <SymbolView name="mappin.and.ellipse" tintColor={theme.colors.muted} size={theme.sizes.rowGlyph} />
              <Text variant="bodyLarge" color="muted">
                {[profile.city, profile.online ? t('invites.detail.alsoOnline') : '']
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          ) : null}

          <View style={styles.noteCard}>
            <Text variant="labelStrong" color="nutritionInk">
              {t('requestProposal.suggestsAt', { name: first, time: relativeTime(t, proposal.proposedAt) })}
            </Text>
            {statement ? <Text variant="bodyLarge">{statement}</Text> : null}
            {questionnaireTitle ? (
              <Text variant="bodySmall" color="muted">
                {t('requestProposal.questionnaire', { title: questionnaireTitle })}
              </Text>
            ) : null}
          </View>

          {pack ? (
            <ProposalPackageCard
              pack={pack}
              discount={proposal.discount}
              description={description || undefined}
              coachFirstName={first}
              showPrices={paymentsEnabled}
            />
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('invites.detail.viewProfile', { name: first })}
            disabled={!request.professionalPublicId}
            onPress={() =>
              router.push({
                pathname: '/coach/[publicId]',
                params: { publicId: request.professionalPublicId ?? '' },
              })
            }
            style={({ pressed }) => [styles.profileRow, pressed && styles.pressed]}
          >
            <InviteAvatar name={name} />
            <View style={styles.profileCopy}>
              <Text variant="bodyStrong">{t('invites.detail.viewProfile', { name: first })}</Text>
              <Text variant="caption" color="muted">
                {t('invites.detail.viewProfileHint')}
              </Text>
            </View>
            <SymbolView name="chevron.right" tintColor={theme.colors.muted} size={theme.sizes.coachChevron} />
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.back}>
        <BackButton label={t('requestProposal.back')} onPress={leave} />
      </View>
      <View style={styles.bar}>
        <Text variant="caption" color="muted" style={styles.note}>
          {t('requestProposal.barNote', { name: first })}
        </Text>
        <InviteActions
          busy={busy}
          acceptLabel={t('requestProposal.accept')}
          declineLabel={t('requestProposal.decline')}
          onAccept={() => accept(request.publicId ?? id)}
          onDecline={() => decline(request.publicId ?? id)}
        />
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
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      paddingBottom:
        theme.sizes.buttonLarge +
        theme.typography.caption.lineHeight * 2 +
        Math.max(insets.bottom, theme.spacing.xl) +
        theme.spacing.huge,
    },
    hero: {
      height: theme.sizes.inviteHero,
      backgroundColor: theme.colors.avatar,
    },
    heroImage: StyleSheet.absoluteFill,
    back: {
      position: 'absolute',
      top: insets.top + theme.spacing.safeAreaGap,
      left: theme.spacing.xxl,
    },
    sheet: {
      gap: theme.spacing.xl,
      marginTop: -theme.glass.sheet.radius,
      padding: theme.spacing.xxl,
      borderTopLeftRadius: theme.glass.sheet.radius,
      borderTopRightRadius: theme.glass.sheet.radius,
      backgroundColor: theme.colors.ground,
    },
    nameRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    name: {
      flexShrink: 1,
    },
    location: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    noteCard: {
      gap: theme.spacing.xs,
      padding: theme.spacing.xl,
      borderRadius: theme.radii.xxl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.xl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    pressed: {
      opacity: theme.opacity.pressedRow,
    },
    profileCopy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.hair,
    },
    note: {
      textAlign: 'center',
    },
    bar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      gap: theme.spacing.md,
      paddingTop: theme.spacing.md,
      paddingHorizontal: theme.spacing.xxl,
      paddingBottom: Math.max(insets.bottom, theme.spacing.xl),
      backgroundColor: theme.colors.ground,
    },
    stateBack: {
      alignItems: 'flex-start',
      paddingTop: insets.top + theme.spacing.safeAreaGap,
      paddingHorizontal: theme.spacing.xxl,
    },
    state: {
      flex: 1,
      justifyContent: 'center',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.xxl,
    },
    centeredText: {
      textAlign: 'center',
    },
  });
