import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { FlowFrame } from '@/components/questionnaire/FlowFrame';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type FlowStateProps = {
  onClose: () => void;
} & (
  | { kind: 'loading' }
  | { kind: 'message'; title: string; body: string }
  | { kind: 'retry'; title: string; body: string; onRetry: () => void }
);

/** The flow before there is anything to fill in: loading, or a message with a way out. */
export function FlowState(props: FlowStateProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <FlowFrame
      header={{ onClose: props.onClose }}
      contentStyle={styles.content}
      footer={
        props.kind === 'retry' ? (
          <Button label={t('questionnaireFill.retry')} onPress={props.onRetry} />
        ) : props.kind === 'message' ? (
          <Button label={t('questionnaireFill.close')} onPress={props.onClose} />
        ) : null
      }
    >
      {props.kind === 'loading' ? (
        <View accessibilityRole="progressbar" accessibilityLabel={t('questionnaireFill.loading')}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <View style={styles.message}>
          <Text variant="heading" style={styles.centered}>
            {props.title}
          </Text>
          <Text variant="body" color="muted" style={styles.centered}>
            {props.body}
          </Text>
        </View>
      )}
    </FlowFrame>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    message: {
      gap: theme.spacing.xs,
    },
    centered: {
      textAlign: 'center',
    },
  });
