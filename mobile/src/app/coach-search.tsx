import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BackButton } from '@/components/BackButton';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** Placeholder for the coach search; `role` selects Trainer or Nutritionist. */
export default function CoachSearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { role } = useLocalSearchParams<{ role?: string }>();
  const title =
    role === 'Nutritionist' ? t('coachSearch.nutritionistTitle') : t('coachSearch.trainerTitle');

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.back}>
        <BackButton label={t('onboarding.back')} onPress={() => router.back()} />
      </View>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="bodyLarge" color="muted">
        {t('coachSearch.soon')}
      </Text>
    </Screen>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.xl,
      paddingTop: theme.spacing.xxl,
    },
    back: {
      alignItems: 'flex-start',
    },
  });
