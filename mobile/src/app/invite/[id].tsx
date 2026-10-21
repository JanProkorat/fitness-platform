import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { InviteActions } from '@/components/invites/InviteActions';
import { RoleChip } from '@/components/invites/RoleChip';
import { expiryLabel, firstName, parseCoachRoles, relativeTime } from '@/components/invites/format';
import { Text } from '@/components/Text';
import { useInviteActions } from '@/hooks/useInviteActions';
import { useInviteCoach } from '@/hooks/useInviteCoach';
import { useInvites } from '@/hooks/useInvites';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type Offer = { key: string; symbol: SFSymbol; tone: 'training' | 'nutrition' | 'error' | 'muted' };

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
  const roles = parseCoachRoles(invite.coachRole);
  const city = profile?.city || invite.coachCity;
  const expiry = expiryLabel(t, invite.expiresAt);
  const avatarUrl = profile?.avatarBlobUrl?.startsWith('http') ? profile.avatarBlobUrl : undefined;
  const offers: Offer[] = [
    ...(roles.includes('Trainer') ? [{ key: 'training', symbol: 'dumbbell', tone: 'training' } as Offer] : []),
    ...(roles.includes('Nutritionist') ? [{ key: 'nutrition', symbol: 'leaf', tone: 'nutrition' } as Offer] : []),
    { key: 'checkins', symbol: 'list.clipboard', tone: 'error' },
    { key: 'chat', symbol: 'bubble.left', tone: 'muted' },
  ];
  const tone = (value: Offer['tone']) =>
    value === 'training'
      ? { background: theme.colors.trainingSoft, foreground: theme.colors.trainingInk }
      : value === 'nutrition'
        ? { background: theme.colors.nutritionSoft, foreground: theme.colors.nutritionInk }
        : value === 'error'
          ? { background: theme.colors.errorSoft, foreground: theme.colors.error }
          : { background: theme.colors.field, foreground: theme.colors.muted };

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

          {profile?.bio ? <Text variant="bodyLarge">{profile.bio}</Text> : null}
          {profile?.specializations && profile.specializations.length > 0 ? (
            <View style={styles.specialties}>
              {profile.specializations.map((specialty) => (
                <View key={specialty} style={styles.specialty}>
                  <Text variant="bodySmall">{specialty}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text variant="overline" color="muted" style={styles.overline}>
            {t('invites.detail.workingWith', { name: first }).toUpperCase()}
          </Text>
          <View style={styles.offers}>
            {offers.map((offer, index) => {
              const look = tone(offer.tone);
              return (
                <View key={offer.key} style={[styles.offer, index > 0 && styles.offerDivider]}>
                  <View style={[styles.offerIcon, { backgroundColor: look.background }]}>
                    <SymbolView name={offer.symbol} tintColor={look.foreground} size={theme.sizes.rowGlyph} />
                  </View>
                  <Text variant="bodyLarge">{t(`invites.detail.offers.${offer.key}`)}</Text>
                </View>
              );
            })}
          </View>
          <Text variant="caption" color="muted" style={styles.note}>
            {t('invites.detail.shareNote', { name: first })}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.back}>
        <BackButton label={t('invites.detail.back')} onPress={leave} />
      </View>
      <View style={styles.bar}>
        <InviteActions
          size="detail"
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
      paddingBottom: theme.sizes.buttonLarge + Math.max(insets.bottom, theme.spacing.xl) + theme.spacing.huge,
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
    specialties: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
    specialty: {
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
    },
    overline: {
      letterSpacing: theme.typography.overline.letterSpacing,
    },
    offers: {
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.xxl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    offer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    offerDivider: {
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.line,
    },
    offerIcon: {
      width: theme.sizes.rowIcon,
      height: theme.sizes.rowIcon,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    note: {
      textAlign: 'center',
    },
    bar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: theme.spacing.md,
      paddingHorizontal: theme.spacing.xxl,
      paddingBottom: Math.max(insets.bottom, theme.spacing.xl),
      backgroundColor: theme.colors.ground,
    },
  });
