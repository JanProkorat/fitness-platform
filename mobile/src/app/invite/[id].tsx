import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { InviteActions } from '@/components/invites/InviteActions';
import { InviteAvatar } from '@/components/invites/InviteAvatar';
import { InvitePackageCard } from '@/components/invites/InvitePackageCard';
import { RoleChip } from '@/components/invites/RoleChip';
import { expiryLabel, firstName, relativeTime } from '@/components/invites/format';
import { Text } from '@/components/Text';
import { useInviteActions } from '@/hooks/useInviteActions';
import { useInviteCoach } from '@/hooks/useInviteCoach';
import { useInvites } from '@/hooks/useInvites';
import { usePaymentsEnabled } from '@/hooks/usePaymentsEnabled';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export default function InviteDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets);
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { data: invites, isPending } = useInvites();
  const invite = invites?.find((candidate) => candidate.id === id);
  const coach = useInviteCoach(invite?.coachPublicId);
  const { enabled: paymentsEnabled } = usePaymentsEnabled();
  const left = useRef(false);
  // Both the action callback and the "gone" effect can fire; leave exactly once.
  const leave = () => {
    if (left.current) return;
    left.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const { accept, decline, pendingId } = useInviteActions({ onSettled: leave });

  // An invite that is no longer pending (answered, cancelled, expired) has nothing to show.
  const gone = !isPending && invites !== undefined && !invite;
  useEffect(() => {
    if (gone) leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gone]);

  if (!invite) {
    return <View style={styles.root} />;
  }

  const name = invite.coachName ?? '';
  const first = firstName(name);
  const profile = coach.data;
  const city = profile?.city || invite.coachCity;
  const expiry = expiryLabel(t, invite.expiresAt);
  const avatarUrl = profile?.avatarBlobUrl?.startsWith('http') ? profile.avatarBlobUrl : undefined;
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
            <RoleChip coachRole={invite.coachRole} />
          </View>
          {city || profile?.online ? (
            <View style={styles.location}>
              <SymbolView name="mappin.and.ellipse" tintColor={theme.colors.muted} size={theme.sizes.rowGlyph} />
              <Text variant="bodyLarge" color="muted">
                {[city, profile?.online ? t('invites.detail.alsoOnline') : '']
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          ) : null}

          <View style={styles.inviteCard}>
            <Text variant="labelStrong" color="nutritionInk">
              {t('invites.detail.invitedYouAt', { name: first, time: relativeTime(t, invite.sentAt) })}
            </Text>
            {invite.message ? <Text variant="bodyLarge">{invite.message}</Text> : null}
            {expiry ? (
              <Text variant="bodySmall" color="muted">
                {expiry}
              </Text>
            ) : null}
          </View>

          {invite.package ? (
            <InvitePackageCard pack={invite.package} coachFirstName={first} showPrices={paymentsEnabled} />
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('invites.detail.viewProfile', { name: first })}
            disabled={!invite.coachPublicId}
            onPress={() =>
              router.push({ pathname: '/coach/[publicId]', params: { publicId: invite.coachPublicId ?? '', from: 'invite' } })
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
        <BackButton label={t('invites.detail.back')} onPress={leave} />
      </View>
      <View style={styles.bar}>
        <Text variant="caption" color="muted" style={styles.note}>
          {t(invite.package ? 'invites.detail.shareNoteWithPackage' : 'invites.detail.shareNote', { name: first })}
        </Text>
        <InviteActions
          busy={pendingId !== null}
          onAccept={() => accept(invite.id ?? id)}
          onDecline={() => decline(invite.id ?? id)}
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
    inviteCard: {
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
      opacity: 0.7,
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
  });
