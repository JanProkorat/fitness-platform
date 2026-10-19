import { StyleSheet, View } from 'react-native';

import { OptionalPill } from '@/components/onboarding/OptionalPill';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type FieldLabelProps = {
  label: string;
  optional?: boolean;
  /** Text on the right, such as a readout of the selected value. Reserve its space with a placeholder. */
  readout?: string;
};

/** The caption above a control. */
export function FieldLabel({ label, optional = false, readout }: FieldLabelProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.row}>
      <Text variant="body" color="muted" style={styles.label}>
        {label}
      </Text>
      {readout !== undefined ? <Text variant="bodyStrong">{readout}</Text> : null}
      {optional ? <OptionalPill /> : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    label: {
      flex: 1,
      minWidth: 0,
    },
  });
