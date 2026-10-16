import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export default function Index() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.screen}>
      <Text style={styles.body}>{t('app.placeholder')}</Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.xxl,
      backgroundColor: theme.colors.ground,
    },
    body: {
      ...theme.typography.body,
      color: theme.colors.muted,
    },
  });
