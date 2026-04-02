import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth';
import { Colors } from '../../constants/Colors';
import { resendVerification } from '../../src/api/verification';
import { connect, onEvent, disconnect } from '../../src/api/signalr';

export default function VerifyEmailScreen() {
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
        setError('Nepodařilo se odeslat e-mail');
      }
    } finally {
      setResending(false);
    }
  }, []);

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
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Logo */}
        <Text style={styles.logo}>
          <Text style={styles.logoGf}>GF</Text>
          <Text style={styles.logoPlatform}> PLATFORM</Text>
        </Text>

        {/* Icon */}
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>✉️</Text>
        </View>

        <Text style={styles.title}>Ověřte svůj e-mail</Text>
        <Text style={styles.subtitle}>
          Na váš e-mail jsme odeslali ověřovací odkaz. Klikněte na něj pro
          aktivaci účtu.
        </Text>

        {/* Email box */}
        {user?.email && (
          <View style={styles.emailBox}>
            <Text style={styles.emailLabel}>E-mail:</Text>
            <Text style={styles.emailValue}>{user.email}</Text>
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}
        {resendSuccess && (
          <Text style={styles.successText}>
            Ověřovací e-mail byl odeslán znovu.
          </Text>
        )}

        <Text style={styles.hint}>Zkontrolujte i složku se spamem.</Text>

        {/* Resend button */}
        {remainingResends === 0 ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Dosáhli jste maximálního počtu odeslání.
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleResend}
            disabled={resending}
          >
            <Text style={styles.primaryBtnText}>
              {resending ? 'Odesílám...' : 'Odeslat znovu'}
            </Text>
          </TouchableOpacity>
        )}

        {remainingResends !== null && remainingResends > 0 && (
          <Text style={styles.remainingText}>
            Zbývá odeslání: {remainingResends}
          </Text>
        )}

        {/* Manual check button */}
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={handleCheckManually}
          disabled={checking}
        >
          <Text style={styles.secondaryBtnText}>
            {checking ? 'Kontroluji...' : 'Již jsem ověřil/a'}
          </Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Odhlásit se</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
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
    color: Colors.dark.gold,
  },
  logoPlatform: {
    fontSize: 22,
    fontWeight: '400',
    letterSpacing: 1,
    color: Colors.dark.text2,
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
    color: Colors.dark.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.text2,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emailBox: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    backgroundColor: Colors.dark.surface,
    marginBottom: 12,
  },
  emailLabel: { fontSize: 11, color: Colors.dark.text3, marginBottom: 2 },
  emailValue: { fontSize: 14, fontWeight: '500', color: Colors.dark.text },
  errorText: { fontSize: 13, color: Colors.dark.red, marginBottom: 8 },
  successText: { fontSize: 13, color: Colors.dark.green, marginBottom: 8 },
  hint: { fontSize: 13, color: Colors.dark.text3, marginBottom: 16 },
  warningBox: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(173,87,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(173,87,0,0.3)',
    marginBottom: 12,
  },
  warningText: { fontSize: 13, color: '#ad5700', textAlign: 'center' },
  primaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 4,
    backgroundColor: Colors.dark.gold,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#000',
    textTransform: 'uppercase',
  },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryBtnText: { fontSize: 13, color: Colors.dark.text2 },
  remainingText: {
    fontSize: 12,
    color: Colors.dark.text3,
    marginBottom: 8,
  },
  logoutBtn: { marginTop: 8 },
  logoutText: {
    fontSize: 13,
    color: Colors.dark.text3,
    textDecorationLine: 'underline',
  },
});
