import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { PendingQuestionnaire } from '@/api/questionnaires';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { fillRoute, formTitle, questionCountHint } from './pendingForms';

type QuestionnaireBannerProps = { item: PendingQuestionnaire };

/** One pending questionnaire on Today: who sent it, how long it is, and a Fill in button. */
export function QuestionnaireBanner({ item }: QuestionnaireBannerProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const route = fillRoute(item);
  if (!route) return null;
  const hint = questionCountHint(t, item, 'banner');

  return (
    <View style={styles.banner}>
      <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <SymbolView name="list.clipboard" tintColor={theme.colors.nutritionInk} size={theme.sizes.coachGlyph} />
      </View>
      <View style={styles.copy}>
        <Text variant="link" numberOfLines={2}>
          {formTitle(t, item)}
        </Text>
        {hint ? (
          <Text variant="caption" color="ink2">
            {hint}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('today.questionnaire.fillLabel', { title: formTitle(t, item) })}
        onPress={() => router.push(route)}
        style={styles.action}
      >
        <Text variant="labelStrong" color="onPrimary">
          {t('today.questionnaire.fill')}
        </Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      paddingLeft: theme.spacing.lg,
      paddingRight: theme.spacing.md,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.nutritionSoft,
    },
    icon: {
      width: theme.sizes.coachIcon,
      height: theme.sizes.coachIcon,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs / 2,
    },
    action: {
      height: theme.sizes.stepButton,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
  });
