import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { Conversation } from '@/api/conversations';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { MessageAvatar } from './MessageAvatar';
import { RolePill } from './RolePill';
import { cooperationLabel, listTime, readOnlyLine } from './format';

type ConversationRowProps = {
  conversation: Conversation;
  onPress: () => void;
};

function previewText(t: ReturnType<typeof useTranslation>['t'], conversation: Conversation): string {
  const text = conversation.lastMessage?.trim() ?? '';
  const body =
    text ||
    (conversation.lastMessageHasImage
      ? t('messages.photo')
      : conversation.lastMessageEventType
        ? t(`messages.eventPreview.${conversation.lastMessageEventType}`)
        : '');
  return conversation.lastMessageIsOwn && body ? t('messages.you', { text: body }) : body;
}

/** One conversation in the Messages list; an active coach shows the unread style, a past coach is read only. */
export function ConversationRow({ conversation, onPress }: ConversationRowProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const name = conversation.participant?.name ?? '';
  const unread = conversation.unreadCount ?? 0;
  const isUnread = unread > 0;

  if (conversation.isFormer) {
    const subtitle = readOnlyLine(t, i18n.language, conversation.endedAt);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}. ${subtitle}`}
        onPress={onPress}
        style={styles.row}
      >
        <MessageAvatar name={name} size={theme.sizes.coachAvatar} muted />
        <View style={styles.copy}>
          <Text variant="subtitle" color="ink2" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="body" color="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <SymbolView name="chevron.right" tintColor={theme.colors.muted} size={theme.sizes.coachChevron} />
      </Pressable>
    );
  }

  const label = cooperationLabel(t, conversation.cooperation);
  const time = listTime(t, i18n.language, conversation.lastMessageAt);
  const preview = previewText(t, conversation);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${isUnread ? `${t('messages.unreadCount', { count: unread })}. ` : ''}${t('messages.openChat', { name })}`}
      onPress={onPress}
      style={[styles.row, isUnread && styles.rowUnread]}
    >
      <MessageAvatar name={name} size={theme.sizes.coachAvatar} />
      <View style={styles.copy}>
        <View style={styles.top}>
          <View style={styles.identity}>
            <Text variant={isUnread ? 'subtitle' : 'bodyStrong'} numberOfLines={1} style={styles.name}>
              {name}
            </Text>
            <RolePill roles={conversation.participant?.roles} />
            {label ? (
              <Text variant="caption" color="muted">
                {label}
              </Text>
            ) : null}
          </View>
          <Text variant={isUnread ? 'captionStrong' : 'caption'} color={isUnread ? 'accent' : 'muted'}>
            {time}
          </Text>
        </View>
        <View style={styles.bottom}>
          <Text
            variant="body"
            color={isUnread ? 'ink' : 'muted'}
            numberOfLines={1}
            style={styles.preview}
          >
            {preview}
          </Text>
          {isUnread ? (
            <View style={styles.badge}>
              <Text variant="captionStrong" style={{ color: theme.colors.onAccent }}>
                {unread > 99 ? '99+' : String(unread)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.lg,
      padding: theme.spacing.lg,
      borderRadius: theme.radii.xl,
    },
    rowUnread: {
      backgroundColor: theme.colors.accentSoft,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs,
    },
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.xs,
    },
    identity: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: theme.spacing.xs,
    },
    name: {
      flexShrink: 1,
    },
    bottom: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    preview: {
      flex: 1,
    },
    badge: {
      minWidth: theme.sizes.countBadge,
      height: theme.sizes.countBadge,
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.accent,
    },
  });
