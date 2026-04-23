import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/hooks/useTheme';

export default function LoginScreen() {
  const colors = useTheme();
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      const { data: profile } = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      });
      login(
        {
          publicId: profile.userId,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          roles: profile.roles ?? [],
          isOnboardingComplete: profile.isOnboardingComplete ?? null,
          emailConfirmed: data.emailConfirmed ?? profile.emailConfirmed ?? false,
          hasActiveLink: profile.hasActiveLink ?? false,
          hasPendingQuestionnaire: profile.hasPendingQuestionnaire ?? false,
          linkedRoles: profile.linkedRoles ?? [],
          avatarBlobUrl: profile.avatarBlobUrl ?? null,
        },
        data.accessToken,
        data.refreshToken
      );
    } catch {
      Alert.alert('Login Failed', 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={[styles.logo, { color: colors.label }]}>
          GoodFellas <Text style={[styles.logoAccent, { color: colors.gold }]}>Platform</Text>
        </Text>
        <Text style={[styles.subtitle, { color: colors.label3 }]}>Sign in to continue</Text>

        <TextInput
          style={[styles.input, { backgroundColor: colors.bg2, borderColor: colors.sep, color: colors.label }]}
          placeholder="Email"
          placeholderTextColor={colors.label3}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.bg2, borderColor: colors.sep, color: colors.label }]}
          placeholder="Password"
          placeholderTextColor={colors.label3}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.gold }, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/(auth)/register')}
          style={styles.linkRow}
        >
          <Text style={[styles.linkText, { color: colors.label3 }]}>
            Don't have an account?{' '}
            <Text style={[styles.linkAccent, { color: colors.gold }]}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    fontSize: 28,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  logoAccent: {},
  subtitle: {
    fontSize: 14,
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  button: {
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  linkRow: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
  },
  linkAccent: {
    fontWeight: '700',
  },
});
