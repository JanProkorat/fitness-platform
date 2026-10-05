import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

// Temporary token showcase: labels are placeholders until i18n lands with the first real screen.
export default function Index() {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Form Up</Text>
      <Text style={styles.body}>Theme showcase</Text>

      <View style={styles.row}>
        <Chip variant="training" label="Training" />
        <Chip variant="nutrition" label="Nutrition" />
      </View>

      <Button variant="ink" label="Continue" />
      <Button variant="training" label="Start workout" />
      <Button variant="nutrition" label="Log meal" />
      <Button variant="destructive" label="Delete" />
      <View style={styles.row}>
        <Button size="small" variant="ink" label="Edit" />
        <Button size="small" variant="destructive" label="Remove" />
      </View>
    </ScrollView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.ground,
    },
    content: {
      padding: theme.spacing.xxl,
      paddingTop: theme.spacing.huge * 2,
      gap: theme.spacing.xl,
    },
    title: {
      ...theme.typography.title,
      color: theme.colors.ink,
    },
    body: {
      ...theme.typography.body,
      color: theme.colors.muted,
    },
    row: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
  });
