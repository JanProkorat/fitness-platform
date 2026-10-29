import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { WeekRow } from '@/components/nutrition/plan/WeekRow';
import type { WeekRowKind } from '@/components/nutrition/plan/WeekRow';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export type PlanListRow = {
  planId: string;
  kind: Extract<WeekRowKind, 'future' | 'current' | 'past'>;
  title: string;
  subtitle: string;
  detail?: string;
  detailTone: 'accent' | 'muted';
};

type PlansSectionProps = {
  title: string;
  rows: readonly PlanListRow[];
  onOpen: (planId: string) => void;
};

/** One titled card of the "Your plans" list; renders nothing when it has no plans. */
export function PlansSection({ title, rows, onOpen }: PlansSectionProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  if (rows.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text variant="overline" color="muted" style={styles.title}>
        {title.toUpperCase()}
      </Text>
      <Card style={styles.card}>
        {rows.map((row, index) => (
          <WeekRow
            key={row.planId}
            kind={row.kind}
            first={index === 0}
            title={row.title}
            subtitle={row.subtitle}
            detail={row.detail}
            detailTone={row.detailTone}
            onPress={() => onOpen(row.planId)}
          />
        ))}
      </Card>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    section: {
      gap: theme.spacing.md,
    },
    title: {
      paddingHorizontal: theme.spacing.xxs,
    },
    card: {
      paddingVertical: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.cardInset,
    },
  });
