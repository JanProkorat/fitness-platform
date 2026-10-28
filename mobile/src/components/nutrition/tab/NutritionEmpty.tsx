import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { isPendingRequest } from '@/api/clientRequests';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { firstName, initials } from '@/components/invites/format';
import { useCancelClientRequest, useMyClientRequests } from '@/hooks/useMyClientRequests';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days since an ISO time; undefined when the time is unusable. */
function daysSince(iso: string | undefined): number | undefined {
  const then = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(then) ? undefined : Math.max(0, Math.floor((Date.now() - then) / DAY_MS));
}

/** No nutritionist yet: invitation to find one, plus any request still waiting for a reply. */
export function NutritionEmpty() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const requests = useMyClientRequests();
  const cancel = useCancelClientRequest();
  const pending = (requests.data ?? []).filter(isPendingRequest);

  const sentLabel = (iso: string | undefined) => {
    const days = daysSince(iso);
    if (days === undefined) return t('nutritionTab.empty.waiting');
    const when =
      days === 0
        ? t('nutritionTab.empty.sentToday')
        : t('nutritionTab.empty.sentDaysAgo', { count: days });
    return `${when} · ${t('nutritionTab.empty.waiting')}`;
  };

  const askCancel = (publicId: string, name: string) => {
    Alert.alert(t('nutritionTab.empty.cancelTitle', { name }), undefined, [
      { text: t('nutritionTab.empty.cancelKeep'), style: 'cancel' },
      {
        text: t('nutritionTab.empty.cancel'),
        style: 'destructive',
        onPress: () =>
          cancel.mutate(publicId, {
            onError: () => Alert.alert(t('nutritionTab.errors.cancelRequest')),
          }),
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <Card style={styles.hero}>
        <View style={styles.heroIcon}>
          <SymbolView name="leaf" tintColor={theme.colors.nutritionInk} size={theme.sizes.heroGlyph} />
        </View>
        <View style={styles.heroCopy}>
          <Text variant="heading" accessibilityRole="header" style={styles.centered}>
            {t('nutritionTab.empty.title')}
          </Text>
          <Text variant="bodyLarge" color="muted" style={styles.centered}>
            {t('nutritionTab.empty.body')}
          </Text>
        </View>
        <Button
          label={t('nutritionTab.empty.find')}
          variant="nutrition"
          icon={<SymbolView name="magnifyingglass" tintColor={theme.colors.onNutrition} size={theme.sizes.fieldIcon} />}
          onPress={() => router.push({ pathname: '/coach-search', params: { role: 'Nutritionist' } })}
        />
      </Card>

      {pending.length > 0 ? (
        <View style={styles.section}>
          <Text variant="overline" color="muted" style={styles.overline}>
            {t('nutritionTab.empty.pending').toUpperCase()}
          </Text>
          {pending.map((request) => {
            const name = request.professionalName ?? '';
            const publicId = request.publicId;
            return (
              <View key={publicId ?? name} style={styles.request}>
                <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Text variant="bodyStrong" style={{ color: theme.colors.onAvatar }}>
                    {initials(name)}
                  </Text>
                </View>
                <View style={styles.requestCopy}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {name || firstName(name)}
                  </Text>
                  <Text variant="bodySmall" color="muted" numberOfLines={2}>
                    {sentLabel(request.sentAt)}
                  </Text>
                </View>
                {publicId ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('nutritionTab.empty.cancelLabel', { name })}
                    accessibilityState={{ disabled: cancel.isPending }}
                    disabled={cancel.isPending}
                    onPress={() => askCancel(publicId, name)}
                    style={styles.cancel}
                  >
                    <Text variant="labelStrong">{t('nutritionTab.empty.cancel')}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.note}>
        <SymbolView name="info.circle" tintColor={theme.colors.muted} size={theme.sizes.fieldIcon} />
        <Text variant="bodyLarge" color="muted" style={styles.noteText}>
          {t('nutritionTab.empty.limit')}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      gap: theme.spacing.xl,
    },
    hero: {
      alignItems: 'center',
      gap: theme.spacing.xxl,
      paddingVertical: theme.spacing.xxxl,
    },
    heroIcon: {
      width: theme.sizes.heroIcon,
      height: theme.sizes.heroIcon,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.nutritionSoft,
    },
    heroCopy: {
      gap: theme.spacing.xs,
    },
    centered: {
      textAlign: 'center',
    },
    section: {
      gap: theme.spacing.md,
    },
    overline: {
      letterSpacing: theme.typography.overline.letterSpacing,
    },
    request: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderRadius: theme.radii.xxl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    avatar: {
      width: theme.sizes.coachAvatar,
      height: theme.sizes.coachAvatar,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.avatar,
    },
    requestCopy: {
      flex: 1,
      minWidth: 0,
    },
    cancel: {
      minHeight: theme.sizes.buttonMedium,
      paddingHorizontal: theme.spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
    },
    note: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.xxs,
    },
    noteText: {
      flex: 1,
    },
  });
