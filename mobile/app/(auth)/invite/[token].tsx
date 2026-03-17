import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import api from '../../../src/api/client';
import { useAuthStore } from '../../../src/stores/auth';
import { Colors } from '../../../constants/Colors';

export default function InviteAcceptScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }

    if (!isAuthenticated) {
      // Redirect to login first, then back here
      router.replace(`/(auth)/login?redirect=invite&token=${token}`);
      return;
    }

    // Accept the invitation
    api
      .post(`/trainer/invite/accept`, { token })
      .then(() => {
        setStatus('success');
        setTimeout(() => router.replace('/(client)'), 2000);
      })
      .catch(() => setStatus('error'));
  }, [token, isAuthenticated, router]);

  return (
    <View style={styles.container}>
      {status === 'loading' && (
        <>
          <ActivityIndicator size="large" color={Colors.dark.gold} />
          <Text style={styles.text}>Accepting invitation...</Text>
        </>
      )}
      {status === 'success' && (
        <>
          <Text style={styles.icon}>✓</Text>
          <Text style={styles.text}>Invitation accepted!</Text>
          <Text style={styles.subtext}>Redirecting to your dashboard...</Text>
        </>
      )}
      {status === 'error' && (
        <>
          <Text style={styles.icon}>✗</Text>
          <Text style={styles.text}>Invalid or expired invitation</Text>
          <Text style={styles.subtext}>Please ask your trainer for a new link.</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 32,
  },
  icon: {
    fontSize: 48,
    color: Colors.dark.gold,
    marginBottom: 16,
  },
  text: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginTop: 16,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 14,
    color: Colors.dark.text3,
    marginTop: 8,
    textAlign: 'center',
  },
});
