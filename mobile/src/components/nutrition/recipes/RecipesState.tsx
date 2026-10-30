import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type RecipesStateProps = {
  kind: 'pending' | 'message' | 'offline';
  title?: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Loading, empty, error or not-saved-offline block shown in place of the recipe list. */
export function RecipesState({ kind, title, body, actionLabel, onAction }: RecipesStateProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  if (kind === 'pending') {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }
  const offline = kind === 'offline';
  return (
    <View style={styles.state}>
      {offline ? (
        <View style={styles.iconCircle}>
          <SymbolView
            name="icloud.slash"
            weight="medium"
            tintColor={theme.colors.ink2}
            size={theme.sizes.heroGlyph}
          />
        </View>
      ) : null}
      <Text variant="heading" accessibilityRole="header" style={styles.centered}>
        {offline ? t('offline.notSaved.title') : title}
      </Text>
      <Text variant="body" color="muted" style={styles.centered}>
        {offline ? t('offline.notSaved.body') : body}
      </Text>
      {!offline && actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    state: {
      gap: theme.spacing.xl,
      paddingVertical: theme.spacing.huge,
    },
    centered: {
      textAlign: 'center',
    },
    iconCircle: {
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      width: theme.sizes.heroIcon,
      height: theme.sizes.heroIcon,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.subtle,
    },
  });
