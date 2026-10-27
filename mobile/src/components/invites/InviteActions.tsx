import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type InviteActionsProps = {
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

/** Decline (outlined) and Accept (filled) for the invite on its detail screen. */
export function InviteActions({ busy, onAccept, onDecline }: InviteActionsProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={onDecline}
        style={({ pressed }) => [styles.decline, pressed && styles.pressed, busy && styles.disabled]}
      >
        <Text variant="button" style={styles.declineLabel}>
          {t('invites.decline')}
        </Text>
      </Pressable>
      <Button label={t('invites.acceptInvite')} size="large" disabled={busy} onPress={onAccept} style={styles.accept} />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    accept: {
      flex: 2,
    },
    decline: {
      flex: 1,
      height: theme.sizes.buttonLarge,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    declineLabel: {
      color: theme.colors.ink,
    },
    pressed: {
      opacity: theme.opacity.pressed,
    },
    disabled: {
      opacity: theme.opacity.disabled,
    },
  });
