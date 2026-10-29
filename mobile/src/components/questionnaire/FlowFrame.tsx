import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { FlowHeader } from '@/components/questionnaire/FlowHeader';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type FlowFrameProps = {
  header: Parameters<typeof FlowHeader>[0];
  children: ReactNode;
  /** Pinned under the scrolling body: the action button and any message about it. */
  footer: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

/** The shared screen shell of the questionnaire flow: header, scrolling body, pinned footer. */
export function FlowFrame({ header, children, footer, contentStyle }: FlowFrameProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <FlowHeader {...header} />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentStyle]}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {children}
      </ScrollView>
      <View style={styles.footer}>{footer}</View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme: Theme, insets: EdgeInsets) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.ground,
    },
    header: {
      paddingTop: insets.top + theme.spacing.safeAreaGap,
      paddingBottom: theme.spacing.md,
      paddingLeft: insets.left + theme.spacing.xxl,
      paddingRight: insets.right + theme.spacing.xxl,
    },
    scroll: {
      flex: 1,
    },
    content: {
      gap: theme.spacing.xxl,
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.xxl,
      paddingLeft: insets.left + theme.spacing.xxl,
      paddingRight: insets.right + theme.spacing.xxl,
    },
    footer: {
      gap: theme.spacing.xs,
      paddingTop: theme.spacing.md,
      paddingBottom: Math.max(insets.bottom, theme.spacing.xl),
      paddingLeft: insets.left + theme.spacing.xxl,
      paddingRight: insets.right + theme.spacing.xxl,
    },
  });
