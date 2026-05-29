import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import type { SupplementDto } from '@/api/nutrition';
import { SupplementReminderRow } from './SupplementReminderRow';

// ─── Component ───────────────────────────────────────────────────────────────

export interface SupplementsSectionProps {
  supplements: SupplementDto[];
}

/**
 * Renders the "Recommended supplements" section on the client nutrition screen.
 *
 * The client is read-only (only the coach edits supplements). Each row provides
 * a personal reminder toggle and time-picker backed by MMKV-local storage.
 *
 * Renders nothing when `supplements` is empty.
 */
export function SupplementsSection({
  supplements,
}: SupplementsSectionProps): React.ReactElement | null {
  const { t } = useTranslation();
  const colors = useTheme();

  if (supplements.length === 0) {
    return null;
  }

  const styles = makeStyles(colors);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg2, borderColor: colors.sep }]}>
      <Text style={[styles.sectionTitle, { color: colors.label }]}>
        {t('nutrition.supplements.sectionTitle')}
      </Text>

      {supplements.map((supplement) => (
        <SupplementReminderRow key={supplement.externalId} supplement={supplement} />
      ))}
    </View>
  );
}

export default SupplementsSection;

// ─── Styles ──────────────────────────────────────────────────────────────────

type Colors = ReturnType<typeof useTheme>;

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    container: {
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 4,
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.3,
      marginBottom: 4,
    },
  });
}
