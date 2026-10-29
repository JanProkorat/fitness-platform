import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { Collaboration } from '@/api/collaborations';
import { Chip } from '@/components/Chip';
import { firstName, initials } from '@/components/invites/format';
import { Text } from '@/components/Text';
import { useConversations } from '@/hooks/useConversations';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import type { CoachRole } from './collaborationRoles';
import { findConversation } from './coachSteps';

type CoachBuildingRowProps = {
  role: CoachRole;
  collaboration: Collaboration;
};

/** A linked coach whose plan for this area is not published yet; the button opens the chat with them. */
export function CoachBuildingRow({ role, collaboration }: CoachBuildingRowProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { data: conversations } = useConversations();

  const fullName = collaboration.professionalName?.trim() ?? '';
  const first = firstName(fullName) || t('today.progress.coachFallback');

  const openChat = () => {
    const target = findConversation(conversations, collaboration);
    if (target?.id) router.push({ pathname: '/chat/[id]', params: { id: target.id } });
    else router.push('/messages');
  };

  return (
    <View style={styles.row}>
      <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text variant="labelStrong" style={{ color: theme.colors.onAvatar }}>
          {initials(fullName)}
        </Text>
      </View>
      <View style={styles.copy}>
        <View>
          <Chip size="sm" variant={role === 'Trainer' ? 'training' : 'nutrition'} label={t(`invites.roles.${role}`)} />
        </View>
        <Text variant="bodyStrong">{t(`today.progress.headline.${role}`, { name: first })}</Text>
        <Text variant="caption" color="muted">
          {t('today.areaBlocks.notifyHint')}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('today.progress.messageLabel', { name: first })}
        onPress={openChat}
        style={styles.message}
      >
        <SymbolView name="bubble.left" tintColor={theme.colors.ink} size={theme.sizes.bellGlyph} />
      </Pressable>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.xl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    avatar: {
      width: theme.sizes.inviteAvatar,
      height: theme.sizes.inviteAvatar,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.avatar,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-start',
      gap: theme.spacing.hair,
    },
    message: {
      width: theme.sizes.buttonMedium,
      height: theme.sizes.buttonMedium,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
    },
  });
