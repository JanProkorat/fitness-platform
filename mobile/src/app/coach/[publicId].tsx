import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getErrorStatus } from '@/api/errors';
import { coachFullName, coachInitials, primaryRole } from '@/api/professionals';
import type { CoachRole } from '@/api/professionals';
import { ROLE_NUTRITIONIST } from '@/api/profile';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { CoachAvailability } from '@/components/coach/CoachAvailability';
import { CoachRoleChip } from '@/components/coach/CoachRoleChip';
import { RequestSheet } from '@/components/coach/RequestSheet';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useCoachProfile } from '@/hooks/useCoachProfile';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type WorkingWithRow = { key: 'plan' | 'checkIns' | 'chat'; symbol: SFSymbol };

const WORKING_WITH_ROWS: WorkingWithRow[] = [
  { key: 'plan', symbol: 'dumbbell' },
  { key: 'checkIns', symbol: 'list.clipboard' },
  { key: 'chat', symbol: 'bubble.left' },
];

/** A coach's public profile, with the entry point to send them a request. */
export default function CoachProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const { publicId = '' } = useLocalSearchParams<{ publicId: string }>();
  const query = useCoachProfile(publicId);
  const [sheetOpen, setSheetOpen] = useState(false);
  const back = () => router.back();

  if (query.isPending || query.isError) {
    return (
      <Screen>
        <View style={styles.stateBack}>
          <BackButton label={t('onboarding.back')} onPress={back} />
        </View>
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
  const requestLabel = coach.isLinked
    ? t('coachProfile.linked')
    : coach.hasPendingRequest
      ? t('coachProfile.pending')
      : t('coachProfile.sendRequest');
  const requestDisabled = coach.isLinked || coach.hasPendingRequest || !accepting;
  const rolePrefix = role === ROLE_NUTRITIONIST ? 'Nutritionist' : 'Trainer';

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
          <View style={[styles.back, { top: insets.top + theme.spacing.huge, left: insets.left + theme.spacing.xxl }]}>
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
          <View style={styles.workingWith}>
            <Text variant="overline" color="muted" style={styles.overline}>
              {t('coachProfile.workingWith', { name: firstName }).toUpperCase()}
            </Text>
            <View style={styles.card}>
              {WORKING_WITH_ROWS.map((row, index) => (
                <View key={row.key} style={[styles.row, index > 0 && styles.rowDivider]}>
                  <View
                    style={[
                      styles.rowIcon,
                      { backgroundColor: rowTone(theme, row.key, rolePrefix).background },
                    ]}
                  >
                    <SymbolView
                      name={row.symbol}
                      tintColor={rowTone(theme, row.key, rolePrefix).foreground}
                      size={theme.sizes.rowGlyph}
                    />
                  </View>
                  <Text variant="bodyLarge" style={styles.rowLabel}>
                    {t(`coachProfile.workingWithRows.${rolePrefix}.${row.key}`)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, theme.spacing.xl) }]}>
        <Button
          label={requestLabel}
          disabled={requestDisabled}
          onPress={() => setSheetOpen(true)}
        />
      </View>
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

/** Soft tint behind a row icon: orange for the plan of a trainer, green for a nutritionist's, neutral for chat. */
function rowTone(theme: Theme, key: WorkingWithRow['key'], role: 'Trainer' | 'Nutritionist') {
  const { colors } = theme;
  switch (key) {
    case 'plan':
      return role === 'Trainer'
        ? { background: colors.trainingSoft, foreground: colors.trainingInk }
        : { background: colors.nutritionSoft, foreground: colors.nutritionInk };
    case 'checkIns':
      return { background: colors.accentSoft, foreground: colors.accent };
    case 'chat':
      return { background: colors.field, foreground: colors.ink2 };
  }
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
    workingWith: {
      gap: theme.spacing.md,
    },
    overline: {
      paddingHorizontal: theme.spacing.xs,
      letterSpacing: theme.typography.overline.letterSpacing,
    },
    card: {
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.xxl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    rowDivider: {
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.line,
    },
    rowIcon: {
      width: theme.sizes.rowIcon,
      height: theme.sizes.rowIcon,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: {
      flex: 1,
    },
    footer: {
      paddingHorizontal: theme.spacing.xxl,
      paddingTop: theme.spacing.md,
      backgroundColor: theme.colors.ground,
    },
    stateBack: {
      alignItems: 'flex-start',
      paddingTop: theme.spacing.huge,
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
