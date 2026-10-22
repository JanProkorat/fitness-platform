import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { isAnswersUnavailable } from '@/api/onboardingAnswers';
import { aboutMeRows } from '@/components/profile/aboutMe';
import { ListCard } from '@/components/profile/ListCard';
import { SectionHeader } from '@/components/profile/SectionHeader';
import { Text } from '@/components/Text';
import { useOnboardingAnswers } from '@/hooks/useOnboardingAnswers';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** The client's sign-up answers at a glance; hidden while loading and when they can't be read. */
export function AboutMeCard() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const query = useOnboardingAnswers();

  // No retry box: a 404/409 means there are no answers yet, and any other failure just hides the card.
  if (query.isPending || query.isError || isAnswersUnavailable(query.error)) return null;

  const edit = () => router.push('/profile/edit');

  return (
    <View style={styles.section}>
      <SectionHeader
        title={t('profile.aboutMe.title')}
        trailing={
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('profile.aboutMe.edit')}
            hitSlop={theme.spacing.md}
            onPress={edit}
          >
            <Text variant="labelStrong">{t('profile.aboutMe.edit')}</Text>
          </Pressable>
        }
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('profile.aboutMe.a11yLabel')}
        onPress={edit}
      >
        <ListCard>
          {aboutMeRows(t, i18n.language, query.data).map((row) => (
            <View key={row.key} style={styles.row}>
              <Text variant="body" numberOfLines={1} style={styles.label}>
                {row.label}
              </Text>
              <Text variant="bodySmall" color="muted" numberOfLines={1} style={styles.value}>
                {row.value}
              </Text>
            </View>
          ))}
        </ListCard>
      </Pressable>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    section: {
      gap: theme.spacing.snug,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    label: {
      width: theme.sizes.aboutMeLabel,
      flexShrink: 0,
    },
    value: {
      flex: 1,
      minWidth: 0,
      textAlign: 'right',
    },
  });
