import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isClientProfile } from '@/api/profile';
import { Button } from '@/components/Button';
import { HeroIcon } from '@/components/HeroIcon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { VerifiedNextSteps } from '@/components/VerifiedNextSteps';
import { useProfile } from '@/hooks/useProfile';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export default function VerifiedScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { data: profile } = useProfile();
  const name = profile?.firstName?.trim();
  // Coaches get the same confirmation but not the client-only next steps.
  const isClient = profile ? isClientProfile(profile) : true;

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.main}>
        <View style={styles.hero}>
          <HeroIcon symbol="checkmark" tone="success" />
          <Text variant="title" accessibilityRole="header" style={styles.centered}>
            {t('verified.title')}
          </Text>
          <Text variant="body" color="ink2" style={styles.centered}>
            {name ? t('verified.welcome', { name }) : t('verified.welcomeAnonymous')}
          </Text>
        </View>
        {isClient ? <VerifiedNextSteps /> : null}
      </View>
      <Button
        label={isClient ? t('verified.cta') : t('verified.continue')}
        onPress={() => useAuthStore.getState().acknowledgeVerified()}
      />
    </Screen>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      flex: 1,
      paddingBottom: theme.sizes.authBottom,
    },
    main: {
      flex: 1,
      justifyContent: 'center',
      gap: theme.spacing.huge,
    },
    hero: {
      alignItems: 'center',
      gap: theme.spacing.lg,
    },
    centered: {
      textAlign: 'center',
    },
  });
