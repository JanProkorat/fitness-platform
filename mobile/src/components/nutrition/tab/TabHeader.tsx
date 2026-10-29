import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { GlassButton } from '@/components/profile/GlassButton';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type TabHeaderProps = {
  /** Shortcuts to the plan, recipes and shopping list; shown once a plan is published. */
  withShortcuts?: boolean;
};

/** Title of the Nutrition tab, with the full plan, recipes and shopping list as round buttons. */
export function TabHeader({ withShortcuts = false }: TabHeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const shortcut = (symbol: SFSymbol, label: string, open: () => void) => (
    <GlassButton label={label} onPress={open}>
      <SymbolView name={symbol} tintColor={theme.colors.ink} size={theme.sizes.bellGlyph} />
    </GlassButton>
  );

  return (
    <View style={styles.row}>
      <Text variant="title" accessibilityRole="header" style={styles.title}>
        {t('tabs.nutrition')}
      </Text>
      {withShortcuts ? (
        <View style={styles.actions}>
          {shortcut('calendar', t('nutritionTab.shortcuts.plan'), () => router.push('/nutrition/plans'))}
          {shortcut('book', t('nutritionTab.shortcuts.recipes'), () => router.push('/nutrition/recipes'))}
          {shortcut('cart', t('nutritionTab.shortcuts.shoppingList'), () => router.push('/nutrition/shopping-list'))}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.xl,
    },
    title: {
      flex: 1,
      minWidth: 0,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
  });
