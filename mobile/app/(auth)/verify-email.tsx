import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/hooks/useTheme';
import { Static } from '@/constants/colors';
import { resendVerification } from '@/api/verification';
import { connect, onEvent, disconnect } from '@/api/signalr';

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const router = useRouter();

  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [remainingResends, setRemainingResends] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Connect to SignalR for real-time verification notification
  useEffect(() => {
    connect().catch(() => {});

    const unsubscribe = onEvent('emailVerified', () => {
      refreshProfile();
    });

    return () => {
      unsubscribe();
      disconnect().catch(() => {});
    };
  }, [refreshProfile]);

  const handleResend = useCallback(async () => {
    setResending(true);
    setResendSuccess(false);
    setError(null);
    try {
      const res = await resendVerification();
      setResendSuccess(true);
      setRemainingResends(res.remainingResends);
    } catch (err: any) {
      const code = err?.response?.data?.errors?.[0]?.errorCode;
      if (code === 'VERIFICATION_RESEND_LIMIT_REACHED') {
        setRemainingResends(0);
      } else {
        setError(t('auth.verifyEmail.resendError'));
      }
    } finally {
      setResending(false);
    }
  }, [t]);

  const handleCheckManually = useCallback(async () => {
    setChecking(true);
    await refreshProfile();
    setChecking(false);
  }, [refreshProfile]);

  const handleLogout = useCallback(() => {
    logout();
    router.replace('/(auth)/login');
  }, [logout, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.card}>
        {/* Logo */}
        <Text style={styles.logo}>
          <Text style={[styles.logoGf, { color: colors.gold }]}>GF</Text>
          <Text style={[styles.logoPlatform, { color: colors.label2 }]}> PLATFORM</Text>
        </Text>

        {/* Icon */}
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>✉️</Text>
        </View>

        <Text style={[styles.title, { color: colors.label }]}>Ověřte svůj e-mail</Text>
        <Text style={[styles.subtitle, { color: colors.label2 }]}>
          Na váš e-mail jsme odeslali ověřovací odkaz. Klikněte na něj pro
          aktivaci účtu.
        </Text>

        {/* Email box */}
        {user?.email && (
          <View style={[styles.emailBox, { backgroundColor: colors.bg2 }]}>
            <Text style={[styles.emailLabel, { color: colors.label3 }]}>E-mail:</Text>
            <Text style={[styles.emailValue, { color: colors.label }]}>{user.email}</Text>
          </View>
        )}

        {error && <Text style={[styles.errorText, { color: colors.red }]}>{error}</Text>}
        {resendSuccess && (
          <Text style={[styles.successText, { color: colors.green }]}>
            Ověřovací e-mail byl odeslán znovu.
          </Text>
        )}

        <Text style={[styles.hint, { color: colors.label3 }]}>Zkontrolujte i složku se spamem.</Text>

        {/* Resend button */}
        {remainingResends === 0 ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Dosáhli jste maximálního počtu odeslání.
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.gold }]}
            onPress={handleResend}
            disabled={resending}
          >
            <Text style={styles.primaryBtnText}>
              {resending ? 'Odesílám...' : 'Odeslat znovu'}
            </Text>
          </TouchableOpacity>
        )}

        {remainingResends !== null && remainingResends > 0 && (
          <Text style={[styles.remainingText, { color: colors.label3 }]}>
            Zbývá odeslání: {remainingResends}
          </Text>
        )}

        {/* Manual check button */}
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.sep }]}
          onPress={handleCheckManually}
          disabled={checking}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.label2 }]}>
            {checking ? 'Kontroluji...' : 'Již jsem ověřil/a'}
          </Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={[styles.logoutText, { color: colors.label3 }]}>Odhlásit se</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  logo: { marginBottom: 32 },
  logoGf: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 3,
  },
  logoPlatform: {
    fontSize: 22,
    fontWeight: '400',
    letterSpacing: 1,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: 'rgba(200,169,78,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,169,78,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: { fontSize: 28 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emailBox: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  emailLabel: { fontSize: 11, marginBottom: 2 },
  emailValue: { fontSize: 14, fontWeight: '500' },
  errorText: { fontSize: 13, marginBottom: 8 },
  successText: { fontSize: 13, marginBottom: 8 },
  hint: { fontSize: 13, marginBottom: 16 },
  warningBox: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(173,87,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(173,87,0,0.3)',
    marginBottom: 12,
  },
  warningText: { fontSize: 13, color: Static.amber, textAlign: 'center' },
  primaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    color: Static.shadow,
    textTransform: 'uppercase',
  },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryBtnText: { fontSize: 13 },
  remainingText: {
    fontSize: 12,
    marginBottom: 8,
  },
  logoutBtn: { marginTop: 8 },
  logoutText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
