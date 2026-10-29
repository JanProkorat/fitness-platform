import { StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { useFill } from '@/components/questionnaire/FillContext';
import { FlowFrame } from '@/components/questionnaire/FlowFrame';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** Sent: confirmation after the answers went through. */
export default function QuestionnaireSentScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const fill = useFill();
  const name = fill.coachFirstName || t('questionnaireFill.coachFallback');

  // Opened without a send (a stale link into the flow): start from the intro.
  if (!fill.sent) {
    return <Redirect href={{ pathname: '/questionnaire/[linkPublicId]', params: { linkPublicId: fill.linkPublicId } }} />;
  }

  const time = fill.sent.at.toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' });

  return (
    <FlowFrame
      header={{ onClose: fill.leave }}
      contentStyle={styles.content}
      footer={<Button label={t('questionnaireFill.sent.back')} onPress={fill.leave} />}
    >
      <Stack.Screen options={{ gestureEnabled: false }} />
      <View style={styles.hero}>
        <View style={styles.seal} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <SymbolView name="checkmark" weight="bold" tintColor={theme.colors.onNutrition} size={theme.sizes.heroGlyph} />
        </View>
        <Text variant="display" accessibilityRole="header" style={styles.centered}>
          {t('questionnaireFill.sent.title')}
        </Text>
        <Text variant="bodyLarge" color="muted" style={styles.centered}>
          {t('questionnaireFill.sent.body', { name })}
        </Text>
      </View>
      <Card style={styles.summary}>
        <View style={styles.summaryIcon}>
          <SymbolView name="doc.text" tintColor={theme.colors.nutritionInk} size={theme.sizes.rowGlyph} />
        </View>
        <View style={styles.summaryCopy}>
          <Text variant="subtitle" numberOfLines={2}>
            {fill.title}
          </Text>
          <Text variant="bodySmall" color="muted">
            {t('questionnaireFill.sent.summary', { count: fill.sent.count, time })}
          </Text>
        </View>
      </Card>
    </FlowFrame>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      gap: theme.spacing.huge,
    },
    hero: {
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    seal: {
      width: theme.sizes.heroIcon + theme.spacing.huge,
      height: theme.sizes.heroIcon + theme.spacing.huge,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.nutrition,
    },
    centered: {
      textAlign: 'center',
    },
    summary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.lg,
    },
    summaryIcon: {
      width: theme.sizes.prepareIcon,
      height: theme.sizes.prepareIcon,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.nutritionSoft,
    },
    summaryCopy: {
      flex: 1,
      minWidth: 0,
    },
  });
