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
import api from '../../src/api/client';
import { useAuthStore } from '../../src/stores/auth';
import { Colors } from '../../constants/Colors';

export default function LoginScreen() {
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>
          GoodFellas <Text style={styles.logoAccent}>Platform</Text>
        </Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.dark.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={Colors.dark.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
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
          <Text style={styles.linkText}>
            Don't have an account?{' '}
            <Text style={styles.linkAccent}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.dark.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  logoAccent: {
    color: Colors.dark.gold,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.text3,
    marginBottom: 32,
  },
  input: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.dark.text,
    marginBottom: 12,
  },
  button: {
    backgroundColor: Colors.dark.gold,
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
    color: Colors.dark.text3,
  },
  linkAccent: {
    color: Colors.dark.gold,
    fontWeight: '700',
  },
});
