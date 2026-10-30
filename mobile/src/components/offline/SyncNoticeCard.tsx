import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { SyncNoticeSheet } from '@/components/offline/SyncNoticeSheet';
import { Text } from '@/components/Text';
import { useDroppedEntries, useOutboxStore, useSyncConflicts } from '@/stores/outbox';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/**
 * The Nutrition tab's compact account of the offline writes that did not go through as the client made
 * them. Tapping it opens the details; the close button, or "Got it" in the sheet, clears the notice for good.
 */
export function SyncNoticeCard() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const conflicts = useSyncConflicts();
  const dropped = useDroppedEntries();
  const clear = useOutboxStore((state) => state.clearSyncNotices);
  const [open, setOpen] = useState(false);

  if (conflicts.length === 0 && dropped.length === 0) return null;

  const parts = [
    conflicts.length > 0 ? t('offlineSync.summary.changed', { count: conflicts.length }) : null,
    dropped.length > 0 ? t('offlineSync.summary.notSaved', { count: dropped.length }) : null,
  ].filter((part): part is string => part !== null);
  const summary = parts.join(t('offlineSync.summary.separator'));
  const title = conflicts.length > 0 ? t('offlineSync.cardTitle') : t('offlineSync.titleDropped');

  const acknowledge = () => {
    setOpen(false);
    void clear();
  };

  return (
    <>
      <Card style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${summary}`}
          accessibilityHint={t('offlineSync.openHint')}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        >
          <View style={styles.badge}>
            <SymbolView
              name="checkmark.arrow.trianglehead.counterclockwise"
              weight="medium"
              tintColor={theme.colors.success}
              size={theme.sizes.bannerGlyph}
            />
          </View>
          <View style={styles.copy}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {title}
            </Text>
            <Text variant="label" color="muted" numberOfLines={1}>
              {summary}
            </Text>
          </View>
          <SymbolView name="chevron.right" weight="medium" tintColor={theme.colors.muted} size={theme.sizes.mealItemChevron} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('offlineSync.dismiss')}
          onPress={() => void clear()}
          style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
        >
          <SymbolView name="xmark" weight="medium" tintColor={theme.colors.muted} size={theme.sizes.sheetCloseGlyph} />
        </Pressable>
      </Card>
      <SyncNoticeSheet visible={open} onClose={() => setOpen(false)} onAcknowledge={acknowledge} />
    </>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      height: theme.sizes.syncCardHeight,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 0,
      paddingLeft: theme.spacing.cardInset,
      paddingRight: theme.spacing.xs,
    },
    main: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    badge: {
      width: theme.sizes.noticeIcon,
      height: theme.sizes.noticeIcon,
      flexShrink: 0,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.successSoft,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    dismiss: {
      width: theme.sizes.sheetClose,
      height: theme.sizes.sheetClose,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: theme.opacity.pressed,
    },
  });
