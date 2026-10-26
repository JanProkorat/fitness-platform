import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { AddMeasurementSheet } from '@/components/measurements/AddMeasurementSheet';
import { Text } from '@/components/Text';
import { useMeasurementHistory } from '@/hooks/useMeasurementHistory';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type StartOnYourOwnProps = {
  /** Shows the "Start on your own" heading and subtitle above the two actions. */
  showHeading?: boolean;
};

/** Log weight (opens the measurement sheet) and Add photo (opens progress photos). */
export function StartOnYourOwn({ showHeading = true }: StartOnYourOwnProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: entries } = useMeasurementHistory();

  return (
    <View style={styles.section}>
      {showHeading ? (
        <View style={styles.heading}>
          <Text variant="overline" color="muted" style={styles.overline}>
            {t('today.own.title').toUpperCase()}
          </Text>
          <Text variant="label" color="muted">
            {t('today.own.subtitle')}
          </Text>
        </View>
      ) : null}
      <View style={styles.row}>
        <Action
          symbol="scalemass"
          label={t('today.own.logWeight')}
          onPress={() => setSheetOpen(true)}
        />
        <Action
          symbol="camera"
          label={t('today.own.addPhoto')}
          onPress={() => router.push('/profile/photos')}
        />
      </View>
      <AddMeasurementSheet
        visible={sheetOpen}
        entries={entries ?? []}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

type ActionProps = {
  symbol: SFSymbol;
  label: string;
  onPress: () => void;
};

function Action({ symbol, label, onPress }: ActionProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.action}>
      <View style={styles.icon}>
        <SymbolView name={symbol} tintColor={theme.colors.actionInk} size={theme.sizes.rowGlyph} />
      </View>
      <Text variant="link" style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    section: {
      gap: theme.spacing.md,
    },
    heading: {
      gap: theme.spacing.xxs,
    },
    overline: {
      letterSpacing: theme.typography.overline.letterSpacing,
    },
    row: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    action: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.xl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    icon: {
      width: theme.sizes.quickIcon,
      height: theme.sizes.quickIcon,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.actionSoft,
    },
    label: {
      flex: 1,
    },
  });
