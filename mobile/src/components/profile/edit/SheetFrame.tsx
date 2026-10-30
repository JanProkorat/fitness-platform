import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type SheetFrameProps = {
  visible: boolean;
  title: string;
  /** Control at the end of the header, such as a Cancel or Done button. */
  action?: ReactNode;
  /** Tapping the dimmed backdrop above the sheet also calls onClose. */
  dismissOnBackdrop?: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** Bottom sheet chrome shared by the My info editors: backdrop, handle and a title row. */
export function SheetFrame({ visible, onClose, dismissOnBackdrop = false, ...rest }: SheetFrameProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <FrameContent {...rest} onBackdropPress={dismissOnBackdrop ? onClose : undefined} />
    </Modal>
  );
}

/** The Cancel control for a sheet header. */
export function SheetCancel({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={theme.spacing.xs}
      onPress={onPress}
      style={{ paddingHorizontal: theme.spacing.xxs }}
    >
      <Text variant="body" color="muted">
        {t('editProfile.cancel')}
      </Text>
    </Pressable>
  );
}

type FrameContentProps = Omit<SheetFrameProps, 'visible' | 'onClose' | 'dismissOnBackdrop'> & {
  onBackdropPress?: () => void;
};

function FrameContent({ title, action = null, onBackdropPress, children }: FrameContentProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {onBackdropPress ? (
        <Pressable accessible={false} importantForAccessibility="no" onPress={onBackdropPress} style={StyleSheet.absoluteFill} />
      ) : null}
      <View accessibilityViewIsModal accessibilityLabel={title} style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text variant="heading" accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {action}
        </View>
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme: Theme, insets: EdgeInsets) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.glass.sheet.backdrop[theme.scheme],
    },
    sheet: {
      gap: theme.spacing.lg,
      paddingTop: theme.spacing.xs,
      paddingHorizontal: theme.spacing.xxl,
      paddingBottom: Math.max(insets.bottom, theme.spacing.xl),
      borderTopLeftRadius: theme.glass.sheet.radius,
      borderTopRightRadius: theme.glass.sheet.radius,
      backgroundColor: theme.colors.surface,
    },
    handle: {
      alignSelf: 'center',
      width: theme.glass.sheet.handleWidth,
      height: theme.glass.sheet.handleHeight,
      borderRadius: theme.radii.xs,
      backgroundColor: theme.colors.lineStrong,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    title: {
      flex: 1,
    },
  });
