import { useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getErrorStatus } from '@/api/errors';
import { coachFullName, coachInitials, primaryRole } from '@/api/professionals';
import type { CoachRole } from '@/api/professionals';
import { PlanState } from '@/components/nutrition/plan/PlanState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { CoachAvailability } from '@/components/coach/CoachAvailability';
import { CoachRoleChip } from '@/components/coach/CoachRoleChip';
import { PackageCarousel } from '@/components/coach/PackageCarousel';
import { ProfileCard, ProfileRow, ProfileSection } from '@/components/coach/ProfileSection';
import { RequestSheet } from '@/components/coach/RequestSheet';
import { instagramUrl, linkLabel, linkedinUrl, websiteUrl } from '@/components/coach/links';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useCoachProfile } from '@/hooks/useCoachProfile';
import { useInvites } from '@/hooks/useInvites';
import { usePaymentsEnabled } from '@/hooks/usePaymentsEnabled';
import { isOfflineEmpty } from '@/lib/queryState';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const COLLABORATION_TYPES = ['online', 'inperson', 'both'] as const;
type CollaborationType = (typeof COLLABORATION_TYPES)[number];

function collaborationTypeOf(raw: string | undefined): CollaborationType | undefined {
  const value = raw?.trim().toLowerCase();
  return COLLABORATION_TYPES.find((type) => type === value);
}

const COLLABORATION_SYMBOLS = {
  online: 'laptopcomputer',
  inperson: 'figure.walk',
  both: 'person.2',
} as const satisfies Record<CollaborationType, string>;

/** Opens an outbound link; a device with no app for it simply does nothing. */
function open(url: string) {
  Linking.openURL(url).catch(() => undefined);
}

/** A coach's public profile, with the entry point to send them a request. */
export default function CoachProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const { publicId = '', from } = useLocalSearchParams<{ publicId: string; from?: string }>();
  const query = useCoachProfile(publicId);
  const invites = useInvites();
  const { enabled: paymentsEnabled } = usePaymentsEnabled();
  const [sheetOpen, setSheetOpen] = useState(false);
  const back = () => router.back();

  if (isOfflineEmpty(query)) {
    return <PlanState kind="offline" onBack={back} />;
  }

  if (query.isPending || query.data === undefined) {
    return (
      <Screen>
        <View style={styles.stateBack}>
          <BackButton label={t('onboarding.back')} onPress={back} />
        </View>
        <OfflineBanner />
        <View style={styles.state}>
          {query.isPending ? (
            <ActivityIndicator color={theme.colors.accent} />
          ) : (
            <>
              <Text variant="heading" accessibilityRole="header" style={styles.centered}>
                {getErrorStatus(query.error) === 404
                  ? t('coachProfile.notFound.title')
                  : t('coachProfile.error.title')}
              </Text>
              <Text variant="body" color="muted" style={styles.centered}>
                {getErrorStatus(query.error) === 404
                  ? t('coachProfile.notFound.body')
                  : t('coachProfile.error.body')}
              </Text>
              {getErrorStatus(query.error) === 404 ? null : (
                <Button label={t('coachProfile.retry')} onPress={() => void query.refetch()} />
              )}
            </>
          )}
        </View>
      </Screen>
    );
  }

  const coach = query.data;
  const role: CoachRole | undefined = primaryRole(coach.roles);
  const firstName = coach.firstName ?? '';
  const where = [coach.city, coach.online ? t('coachProfile.alsoOnline') : undefined]
    .filter(Boolean)
    .join(' · ');
  const accepting = coach.acceptNewClients ?? false;
  // The invite this coach sent, while it is still open: the profile then leads back to it.
  const openInvite = invites.data?.find(
    (invite) => invite.coachPublicId?.toLowerCase() === publicId.toLowerCase(),
  );
  const backToInvite = () => {
    if (from === 'invite' && router.canGoBack()) router.back();
    else if (openInvite?.id) router.push({ pathname: '/invite/[id]', params: { id: openInvite.id } });
  };
  const requestLabel = coach.hasPendingRequest ? t('coachProfile.pending') : t('coachProfile.sendRequest');
  const requestDisabled = coach.hasPendingRequest || !accepting;
  const packages = coach.packages ?? [];
  const collaboration = collaborationTypeOf(coach.collaborationType);
  const certificates =
    (coach.certificateDetails ?? []).length > 0
      ? (coach.certificateDetails ?? []).map((certificate) => ({
          title: certificate.title ?? '',
          detail: [certificate.issuer, certificate.year].filter(Boolean).join(' · '),
        }))
      : (coach.certificates ?? []).map((title) => ({ title, detail: '' }));
  const languages = coach.languages ?? [];
  const links = [
    { kind: 'website', symbol: 'globe', url: websiteUrl(coach.website) },
    { kind: 'instagram', symbol: 'camera', url: instagramUrl(coach.instagram) },
    { kind: 'linkedin', symbol: 'link', url: linkedinUrl(coach.linkedIn) },
  ] as const;
  const visibleLinks = links.filter((link) => link.url !== null);
  const email = coach.contactEmail?.trim();
  const phone = coach.contactPhone?.trim();
  const showFooter = !coach.isLinked;

  return (
    <View style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.hero}>
          {coach.avatarBlobUrl ? (
            <Image source={{ uri: coach.avatarBlobUrl }} style={styles.heroImage} contentFit="cover" />
          ) : (
            <Text variant="display" style={styles.heroInitials}>
              {coachInitials(coach)}
            </Text>
          )}
          <View style={[styles.back, { top: insets.top + theme.spacing.safeAreaGap, left: insets.left + theme.spacing.xxl }]}>
            <BackButton label={t('onboarding.back')} onPress={back} />
          </View>
        </View>
        <View style={styles.sheet}>
          <View style={styles.nameRow}>
            <Text variant="title" accessibilityRole="header" style={styles.name}>
              {coachFullName(coach)}
            </Text>
            {role ? <CoachRoleChip role={role} /> : null}
          </View>
          <OfflineBanner />
          <View style={styles.meta}>
            {where ? (
              <Text variant="body" color="muted">
                {where}
              </Text>
            ) : null}
            <CoachAvailability acceptsNewClients={accepting} />
          </View>
          {coach.bio ? <Text variant="bodyLarge">{coach.bio}</Text> : null}
          {(coach.specializations ?? []).length > 0 ? (
            <View style={styles.pills}>
              {(coach.specializations ?? []).map((value) => (
                <View key={value} style={styles.pill}>
                  <Text variant="body">{value}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <PackageCarousel packages={packages} showPrices={paymentsEnabled} />
          {collaboration ? (
            <ProfileSection label={t('coachProfile.how.title', { name: firstName })}>
              <ProfileCard>
                <ProfileRow
                  first
                  symbol={COLLABORATION_SYMBOLS[collaboration]}
                  title={t(`coachProfile.how.${collaboration}.label`)}
                  subtitle={t(`coachProfile.how.${collaboration}.hint`)}
                />
              </ProfileCard>
            </ProfileSection>
          ) : null}
          {certificates.length > 0 ? (
            <ProfileSection label={t('coachProfile.certificates')}>
              <ProfileCard>
                {certificates.map((certificate, index) => (
                  <ProfileRow
                    key={`${certificate.title}-${index}`}
                    first={index === 0}
                    symbol="rosette"
                    title={certificate.title}
                    subtitle={certificate.detail || undefined}
                  />
                ))}
              </ProfileCard>
            </ProfileSection>
          ) : null}
          {languages.length > 0 ? (
            <ProfileSection label={t('coachProfile.languages')}>
              <View style={styles.pills}>
                {languages.map((language) => (
                  <View key={language} style={styles.pill}>
                    <Text variant="body">{language}</Text>
                  </View>
                ))}
              </View>
            </ProfileSection>
          ) : null}
          {visibleLinks.length > 0 ? (
            <ProfileSection label={t('coachProfile.links')}>
              <ProfileCard>
                {visibleLinks.map((link, index) => (
                  <ProfileRow
                    key={link.kind}
                    first={index === 0}
                    symbol={link.symbol}
                    title={t(`coachProfile.link.${link.kind}`)}
                    subtitle={link.url ? linkLabel(link.url, link.kind) : undefined}
                    chevron
                    onPress={() => (link.url ? open(link.url) : undefined)}
                  />
                ))}
              </ProfileCard>
            </ProfileSection>
          ) : null}
          {email || phone ? (
            <ProfileSection label={t('coachProfile.contact')} note={t('coachProfile.contactNote', { name: firstName })}>
              <ProfileCard>
                {email ? (
                  <ProfileRow
                    first
                    symbol="envelope"
                    title={t('coachProfile.email')}
                    subtitle={email}
                    onPress={() => open(`mailto:${email}`)}
                  />
                ) : null}
                {phone ? (
                  <ProfileRow
                    first={!email}
                    symbol="phone"
                    title={t('coachProfile.phone')}
                    subtitle={phone}
                    onPress={() => open(`tel:${phone.replace(/\s+/g, '')}`)}
                  />
                ) : null}
              </ProfileCard>
            </ProfileSection>
          ) : null}
        </View>
      </ScrollView>
      {showFooter ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, theme.spacing.xl) }]}>
          {openInvite ? (
            <Button label={t('coachProfile.backToInvite')} onPress={backToInvite} />
          ) : (
            <Button label={requestLabel} disabled={requestDisabled} onPress={() => setSheetOpen(true)} />
          )}
        </View>
      ) : null}
      <RequestSheet
        visible={sheetOpen}
        coach={{
          publicId,
          firstName: coach.firstName,
          lastName: coach.lastName,
          avatarBlobUrl: coach.avatarBlobUrl,
        }}
        onClose={() => setSheetOpen(false)}
        onSent={() => setSheetOpen(false)}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.ground,
    },
    scroll: {
      flexGrow: 1,
    },
    hero: {
      height: theme.sizes.coachHero,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.avatar,
    },
    heroImage: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    heroInitials: {
      color: theme.colors.onAvatar,
    },
    back: {
      position: 'absolute',
    },
    sheet: {
      gap: theme.spacing.xl,
      marginTop: -theme.radii.xxl,
      padding: theme.spacing.xxl,
      paddingBottom: theme.spacing.huge,
      borderTopLeftRadius: theme.radii.xxl,
      borderTopRightRadius: theme.radii.xxl,
      backgroundColor: theme.colors.ground,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    name: {
      flexShrink: 1,
    },
    meta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: theme.spacing.lg,
      rowGap: theme.spacing.xxs,
      marginTop: -theme.spacing.md,
    },
    pills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    pill: {
      height: theme.sizes.chip,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
    },
    footer: {
      paddingHorizontal: theme.spacing.xxl,
      paddingTop: theme.spacing.md,
      backgroundColor: theme.colors.ground,
    },
    stateBack: {
      alignItems: 'flex-start',
      paddingTop: theme.spacing.safeAreaGap,
    },
    state: {
      flex: 1,
      justifyContent: 'center',
      gap: theme.spacing.xl,
    },
    centered: {
      textAlign: 'center',
    },
  });
