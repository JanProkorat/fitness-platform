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
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/api/client';
import { useAuthStore } from '../../src/stores/auth';
import { Colors } from '../../constants/Colors';

const ROLES = ['Client', 'Trainer', 'Nutritionist'] as const;

export default function RegisterScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<string>('Client');
  const [gdprConsent, setGdprConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }
    if (!gdprConsent) {
      Alert.alert('Consent Required', 'You must consent to health data processing to register.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        email,
        password,
        confirmPassword,
        firstName,
        lastName,
        role,
        gdprConsent,
      });

      // Auto-login after registration
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
        },
        data.accessToken,
        data.refreshToken
      );
    } catch (e: any) {
      const msg =
        e.response?.data?.errors?.generalErrors?.[0] ??
        e.response?.data?.message ??
        'Registration failed. Please try again.';
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>
          GoodFellas <Text style={styles.logoAccent}>Platform</Text>
        </Text>
        <Text style={styles.subtitle}>Create your account</Text>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="First name"
            placeholderTextColor={Colors.dark.muted}
            value={firstName}
            onChangeText={setFirstName}
            autoComplete="given-name"
          />
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Last name"
            placeholderTextColor={Colors.dark.muted}
            value={lastName}
            onChangeText={setLastName}
            autoComplete="family-name"
          />
        </View>

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
          autoComplete="new-password"
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor={Colors.dark.muted}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        <Text style={styles.label}>I am a</Text>
        <View style={styles.roleRow}>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.rolePill, role === r && styles.rolePillActive]}
              onPress={() => setRole(r)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.rolePillText,
                  role === r && styles.rolePillTextActive,
                ]}
              >
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.consentRow}
          onPress={() => setGdprConsent(!gdprConsent)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, gdprConsent && styles.checkboxChecked]}>
            {gdprConsent && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.consentText}>
            I consent to the processing of my health data (GDPR Art. 9)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creating account...' : 'Create account'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/(auth)/login')}
          style={styles.linkRow}
        >
          <Text style={styles.linkText}>
            Already have an account?{' '}
            <Text style={styles.linkAccent}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  rolePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
  },
  rolePillActive: {
    backgroundColor: Colors.dark.gold,
    borderColor: Colors.dark.gold,
  },
  rolePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.text3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rolePillTextActive: {
    color: '#000',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 20,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: Colors.dark.gold,
    borderColor: Colors.dark.gold,
  },
  checkmark: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.text2,
    lineHeight: 18,
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
