import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import api from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/hooks/useTheme';

export default function InviteAcceptScreen() {
  const colors = useTheme();
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
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {status === 'loading' && (
        <>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.text, { color: colors.label }]}>Accepting invitation...</Text>
        </>
      )}
      {status === 'success' && (
        <>
          <Text style={[styles.icon, { color: colors.gold }]}>✓</Text>
          <Text style={[styles.text, { color: colors.label }]}>Invitation accepted!</Text>
          <Text style={[styles.subtext, { color: colors.label3 }]}>Redirecting to your dashboard...</Text>
        </>
      )}
      {status === 'error' && (
        <>
          <Text style={[styles.icon, { color: colors.gold }]}>✗</Text>
          <Text style={[styles.text, { color: colors.label }]}>Invalid or expired invitation</Text>
          <Text style={[styles.subtext, { color: colors.label3 }]}>Please ask your trainer for a new link.</Text>
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
    paddingHorizontal: 32,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  text: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
