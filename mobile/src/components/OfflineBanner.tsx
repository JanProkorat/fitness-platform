import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/hooks/useTheme';

export function OfflineBanner() {
  const colors = useTheme();
  const isConnected = useNetworkStatus();

  if (isConnected) return null;

  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Offline mode — changes will sync when connected</Text>
    </View>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.gold,
      paddingVertical: 6,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    text: {
      color: colors.label,
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
