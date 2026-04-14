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
import api from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/hooks/useTheme';

const ROLES = ['Client', 'Trainer', 'Nutritionist'] as const;

export default function RegisterScreen() {
  const colors = useTheme();
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
          isOnboardingComplete: profile.isOnboardingComplete ?? null,
          emailConfirmed: false,
          hasActiveLink: false,
          hasPendingQuestionnaire: false,
          linkedRoles: [],
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
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.logo, { color: colors.label }]}>
          GoodFellas <Text style={[styles.logoAccent, { color: colors.gold }]}>Platform</Text>
        </Text>
        <Text style={[styles.subtitle, { color: colors.label3 }]}>Create your account</Text>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.halfInput, { backgroundColor: colors.bg2, borderColor: colors.sep, color: colors.label }]}
            placeholder="First name"
            placeholderTextColor={colors.label3}
            value={firstName}
            onChangeText={setFirstName}
            autoComplete="given-name"
          />
          <TextInput
            style={[styles.input, styles.halfInput, { backgroundColor: colors.bg2, borderColor: colors.sep, color: colors.label }]}
            placeholder="Last name"
            placeholderTextColor={colors.label3}
            value={lastName}
            onChangeText={setLastName}
            autoComplete="family-name"
          />
        </View>

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
          autoComplete="new-password"
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.bg2, borderColor: colors.sep, color: colors.label }]}
          placeholder="Confirm password"
          placeholderTextColor={colors.label3}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        <Text style={[styles.label, { color: colors.label2 }]}>I am a</Text>
        <View style={styles.roleRow}>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.rolePill, role === r && [styles.rolePillActive, { backgroundColor: colors.gold, borderColor: colors.gold }], role !== r && { borderColor: colors.sep }]}
              onPress={() => setRole(r)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.rolePillText,
                  role === r && styles.rolePillTextActive,
                  role !== r && { color: colors.label3 },
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
          <View style={[styles.checkbox, { borderColor: colors.sep, backgroundColor: colors.bg2 }, gdprConsent && [styles.checkboxChecked, { backgroundColor: colors.gold, borderColor: colors.gold }]]}>
            {gdprConsent && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[styles.consentText, { color: colors.label2 }]}>
            I consent to the processing of my health data (GDPR Art. 9)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.gold }, loading && styles.buttonDisabled]}
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
          <Text style={[styles.linkText, { color: colors.label3 }]}>
            Already have an account?{' '}
            <Text style={[styles.linkAccent, { color: colors.gold }]}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  logoAccent: {},
  subtitle: {
    fontSize: 14,
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
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
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
    alignItems: 'center',
  },
  rolePillActive: {},
  rolePillText: {
    fontSize: 13,
    fontWeight: '700',
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
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {},
  checkmark: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
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
