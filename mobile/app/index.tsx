import { StyleSheet, Text, View } from 'react-native';

/**
 * Placeholder root route for the clean-slate UI redesign.
 *
 * All previous screens + the design-token system were removed (see the
 * cleanup manifest for #ui-redesign). This bare screen exists only so
 * Expo Router has something to boot into while the new design system and
 * screens are rebuilt from scratch. No theming — intentional.
 */
export function PlaceholderScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>GoodFellas — UI redesign in progress</Text>
    </View>
  );
}

export default PlaceholderScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
  },
});
