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
import { useTranslation } from 'react-i18next';
import api from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { Colors } from '@/constants/colors';

export default function ForgotPasswordScreen() {
  const colors = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [sentEmail, setSentEmail] = useState<string | null>(null);

  const submit = async (mode: 'send' | 'resend') => {
    const value = email.trim();
    if (!value) return;
    if (mode === 'send') setLoading(true);
    else setResending(true);
    try {
      await api.post('/auth/password/reset', { email: value });
      setSentEmail(value);
    } catch {
      Alert.alert(t('auth.forgot.failedTitle'), t('auth.forgot.failedMessage'));
    } finally {
      if (mode === 'send') setLoading(false);
      else setResending(false);
    }
  };

  const sent = sentEmail !== null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={[styles.logo, { color: colors.label }]}>
          GoodFellas <Text style={[styles.logoAccent, { color: colors.gold }]}>Platform</Text>
        </Text>
        <Text style={[styles.title, { color: colors.label }]}>{t('auth.forgot.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.label3 }]}>{t('auth.forgot.subtitle')}</Text>

        {!sent ? (
          <>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bg2, borderColor: colors.sep, color: colors.label }]}
              placeholder={t('auth.forgot.emailPlaceholder')}
              placeholderTextColor={colors.label3}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.gold }, (loading || !email.trim()) && styles.buttonDisabled]}
              onPress={() => submit('send')}
              disabled={loading || !email.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>
                {loading ? t('auth.forgot.sending') : t('auth.forgot.send')}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={[styles.sentCard, { backgroundColor: colors.bg2, borderColor: colors.sep }]}>
            <Text style={[styles.sentTitle, { color: colors.label }]}>{t('auth.forgot.sentTitle')}</Text>
            <Text style={[styles.sentBody, { color: colors.label2 }]}>
              {t('auth.forgot.sentBody', { email: sentEmail })}
            </Text>
            <TouchableOpacity
              onPress={() => submit('resend')}
              disabled={resending}
              activeOpacity={0.7}
              style={styles.resendBtn}
            >
              <Text style={[styles.resendText, { color: colors.gold }]}>
                {resending ? t('auth.forgot.resending') : t('auth.forgot.resend')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          onPress={() => router.replace('/(auth)/login')}
          style={styles.linkRow}
        >
          <Text style={[styles.linkText, { color: colors.label3 }]}>
            {t('auth.forgot.back')}
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
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
    color: Colors.light.onGoldChip,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sentCard: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 16,
    marginTop: 4,
  },
  sentTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  sentBody: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  resendBtn: {
    alignSelf: 'flex-start',
  },
  resendText: {
    fontSize: 13,
    fontWeight: '700',
  },
  linkRow: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
  },
});
