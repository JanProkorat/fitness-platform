import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BackButton } from '@/components/BackButton';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { MessageAvatar } from './MessageAvatar';
import { roleLine } from './format';

type ChatHeaderProps = {
  name: string | undefined;
  roles: string[] | undefined;
  onBack: () => void;
};

/** Back control and a glass pill with the coach's avatar, name and role line. */
export function ChatHeader({ name, roles, onBack }: ChatHeaderProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const roleText = roleLine(t, roles);

  return (
    <View style={styles.row}>
      <BackButton label={t('chat.back')} onPress={onBack} />
      <View style={styles.pill} accessibilityRole="header">
        <MessageAvatar name={name} size={theme.sizes.chatAvatar} />
        <View style={styles.copy}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {name}
          </Text>
          {roleText ? (
            <Text variant="caption" color="muted" numberOfLines={1}>
              {roleText}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.spacer} />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    pill: {
      flexShrink: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      paddingLeft: theme.spacing.xs,
      paddingRight: theme.spacing.xxl,
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.glassBorder,
      backgroundColor: theme.colors.glassFill,
      boxShadow: theme.shadows.glass,
    },
    copy: {
      flexShrink: 1,
    },
    spacer: {
      width: theme.sizes.backButton,
    },
  });
