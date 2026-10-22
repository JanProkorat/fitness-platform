import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PROFILE_QUERY_KEY } from '@/api/profile';
import { ListCard } from '@/components/profile/ListCard';
import { SectionHeader } from '@/components/profile/SectionHeader';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { OptionSheet } from '@/components/settings/OptionSheet';
import type { SheetOption } from '@/components/settings/OptionSheet';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { Text } from '@/components/Text';
import { useDeleteAccount } from '@/hooks/useDeleteAccount';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useProfile } from '@/hooks/useProfile';
import { APPEARANCES, SUPPORTED_LANGUAGES, isLanguage, usePreferencesStore } from '@/stores/preferences';
import type { AppearancePreference, Language } from '@/stores/preferences';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type OpenSheet = 'language' | 'appearance' | null;

/** Account, language, appearance, message notifications, sign-out and account deletion. */
export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const notifications = useNotificationPreferences();
  const deletion = useDeleteAccount();
  const appearance = usePreferencesStore((state) => state.appearance);
  const setAppearance = usePreferencesStore((state) => state.setAppearance);
  const setLanguage = usePreferencesStore((state) => state.setLanguage);
  const [sheet, setSheet] = useState<OpenSheet>(null);

  const language: Language = isLanguage(i18n.language) ? i18n.language : 'cs';
  const languageOptions: SheetOption<Language>[] = SUPPORTED_LANGUAGES.map((value) => ({
    value,
    label: t(`settings.language.${value}`),
  }));
  const appearanceOptions: SheetOption<AppearancePreference>[] = APPEARANCES.map((value) => ({
    value,
    label: t(`settings.appearance.${value}`),
  }));

  const chooseLanguage = (value: Language) => {
    setSheet(null);
    if (value === language) return;
    setLanguage(value);
    void i18n.changeLanguage(value);
    // The next request carries the new Accept-Language, which is how the server records it.
    void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
  };

  const chooseAppearance = (value: AppearancePreference) => {
    setSheet(null);
    setAppearance(value);
  };

  const confirmDelete = () => {
    deletion.reset();
    Alert.alert(t('settings.delete.title'), t('settings.delete.message'), [
      { text: t('settings.delete.cancel'), style: 'cancel' },
      { text: t('settings.delete.confirm'), style: 'destructive', onPress: () => deletion.submit() },
    ]);
  };

  return (
    <Screen
      scroll
      gutter={theme.spacing.xl}
      topGap={theme.spacing.safeAreaGap}
      bottomInset={theme.spacing.huge}
      contentStyle={styles.content}
    >
      <ScreenHeader
        title={t('settings.title')}
        backLabel={t('settings.back')}
        onBack={() => router.back()}
      />

      <View style={styles.section}>
        <SectionHeader title={t('settings.account.title')} />
        <ListCard>
          <SettingsRow label={t('settings.account.email')} value={profile?.email ?? ''} />
          {profile?.hasPassword ? (
            <SettingsRow
              label={t('settings.account.password')}
              onPress={() => router.push('/profile/change-password')}
            />
          ) : null}
        </ListCard>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('settings.preferences.title')} />
        <ListCard>
          <SettingsRow
            label={t('settings.preferences.language')}
            value={t(`settings.language.${language}`)}
            onPress={() => setSheet('language')}
          />
          <SettingsRow
            label={t('settings.preferences.appearance')}
            value={t(`settings.appearance.${appearance}`)}
            onPress={() => setSheet('appearance')}
          />
        </ListCard>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('settings.notifications.title')} />
        <ListCard>
          <SettingsRow
            label={t('settings.notifications.messages')}
            trailing={
              notifications.isPending ? (
                <ActivityIndicator color={theme.colors.accent} />
              ) : (
                <Switch
                  accessibilityLabel={t('settings.notifications.messages')}
                  value={notifications.messagesEnabled}
                  disabled={notifications.isError || notifications.isSaving}
                  onValueChange={notifications.setMessagesEnabled}
                  trackColor={{ false: theme.colors.fieldBorder, true: theme.colors.nutrition }}
                />
              )
            }
          />
        </ListCard>
        {notifications.isError ? (
          <Text
            variant="label"
            color="error"
            accessibilityRole="alert"
            onPress={() => void notifications.refetch()}
          >
            {t('settings.notifications.loadError')}
          </Text>
        ) : null}
        {notifications.saveFailed ? (
          <Text variant="label" color="error" accessibilityRole="alert">
            {t('settings.notifications.saveError')}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <ListCard>
          <SettingsRow
            label={t('settings.logout')}
            destructive
            onPress={() => void useAuthStore.getState().logout()}
          />
          <SettingsRow
            label={t('settings.delete.row')}
            destructive
            onPress={deletion.isPending ? undefined : confirmDelete}
          />
        </ListCard>
        {deletion.failed ? (
          <Text variant="label" color="error" accessibilityRole="alert">
            {t('settings.delete.error')}
          </Text>
        ) : null}
      </View>

      <OptionSheet
        visible={sheet === 'language'}
        title={t('settings.preferences.language')}
        options={languageOptions}
        selected={language}
        onSelect={chooseLanguage}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'appearance'}
        title={t('settings.preferences.appearance')}
        options={appearanceOptions}
        selected={appearance}
        onSelect={chooseAppearance}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.lg,
    },
    section: {
      gap: theme.spacing.snug,
    },
  });
