import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type InviteActionsProps = {
  /** `card` is the compact Today row; `detail` is the full-size bar on the invite screen. */
  size: 'card' | 'detail';
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

/** Decline (outlined) and Accept (filled) for one invite. */
export function InviteActions({ size, busy, onAccept, onDecline }: InviteActionsProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const height = size === 'card' ? theme.sizes.inviteButton : theme.sizes.buttonLarge;
  const acceptLabel = size === 'card' ? t('invites.accept') : t('invites.acceptInvite');

  const decline = (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={onDecline}
      style={({ pressed }) => [
        styles.decline,
        { height },
        size === 'detail' && styles.detailDecline,
        pressed && styles.pressed,
        busy && styles.disabled,
      ]}
    >
      <Text variant={size === 'card' ? 'buttonSmall' : 'button'} style={styles.declineLabel}>
        {t('invites.decline')}
      </Text>
    </Pressable>
  );
  const accept = (
    <Button
      label={acceptLabel}
      size={size === 'card' ? 'small' : 'large'}
      disabled={busy}
      onPress={onAccept}
      style={[styles.accept, { height }, size === 'detail' && styles.detailAccept]}
    />
  );

  return (
    <View style={styles.row}>
      {size === 'card' ? (
        <>
          {accept}
          {decline}
        </>
      ) : (
        <>
          {decline}
          {accept}
        </>
      )}
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
      flex: 1,
    },
    detailAccept: {
      flex: 1.5,
    },
    decline: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
      backgroundColor: theme.colors.surface,
    },
    detailDecline: {
      flex: 1,
    },
    declineLabel: {
      color: theme.colors.ink,
    },
    pressed: {
      opacity: 0.85,
    },
    disabled: {
      opacity: 0.4,
    },
  });
