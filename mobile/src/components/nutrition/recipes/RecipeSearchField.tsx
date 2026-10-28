import { StyleSheet, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type RecipeSearchFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
};

/** Plain search input shown while the search button is open. */
export function RecipeSearchField({ value, onChangeText }: RecipeSearchFieldProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.field}>
      <SymbolView name="magnifyingglass" tintColor={theme.colors.muted} size={theme.sizes.fieldIcon} />
      <TextInput
        autoFocus
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={t('nutritionRecipes.search.label')}
        placeholder={t('nutritionRecipes.search.placeholder')}
        placeholderTextColor={theme.colors.muted}
        selectionColor={theme.colors.accent}
        returnKeyType="search"
        autoCorrect={false}
        style={styles.text}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    field: {
      height: theme.sizes.field,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.field,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.fieldBorder,
      backgroundColor: theme.colors.field,
    },
    text: {
      ...theme.typography.bodyLarge,
      flex: 1,
      height: '100%',
      padding: 0,
      color: theme.colors.ink,
    },
  });
