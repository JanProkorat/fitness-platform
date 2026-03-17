import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Colors } from '../../constants/Colors';

export function OfflineBanner() {
  const isConnected = useNetworkStatus();

  if (isConnected) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Offline mode — changes will sync when connected</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.gold,
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
});
