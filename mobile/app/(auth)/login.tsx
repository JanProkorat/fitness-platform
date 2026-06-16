import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { ResponseType } from 'expo-auth-session';
import api from '@/api/client';
import { requestSocialNonce, googleSocialLogin } from '@/api/social';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/hooks/useTheme';
import { Colors, type ColorScheme } from '@/constants/colors';

// Required for expo-auth-session to complete the browser redirect on iOS/Android.
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const colors = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Server-issued nonce for the current Google sign-in attempt.
  // Fetched on mount and refreshed after each attempt (nonces are single-use).
  const [googleNonce, setGoogleNonce] = useState<string | null>(null);

  const fetchGoogleNonce = useCallback(async () => {
    try {
      const nonce = await requestSocialNonce();
      setGoogleNonce(nonce);
    } catch {
      // Silent fail — the nonce will be re-fetched on the next attempt if needed.
      setGoogleNonce(null);
    }
  }, []);

  useEffect(() => {
    fetchGoogleNonce();
  }, [fetchGoogleNonce]);

  // Build the Google auth request with the server-issued nonce in extraParams.
  // The nonce is passed as a raw string; Google embeds it verbatim in the
  // returned id_token nonce claim so the backend can verify it.
  // useAuthRequest is a hook and rebuilds whenever the config changes (nonce update).
  const [, googleResponse, promptGoogleAsync] = Google.useAuthRequest(
    {
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      responseType: ResponseType.IdToken,
      // Pass the server-issued nonce so Google embeds it in the id_token claim.
      // The library only generates its own nonce when extraParams.nonce is absent.
      extraParams: googleNonce ? { nonce: googleNonce } : undefined,
    },
  );

  // Process the Google auth response whenever it changes.
  useEffect(() => {
    if (!googleResponse || googleResponse.type === 'opened') return;

    const handleGoogleResponse = async () => {
      try {
        if (googleResponse.type === 'cancel' || googleResponse.type === 'dismiss') {
          // User closed the browser — return to default state silently.
          return;
        }

        if (googleResponse.type !== 'success') {
          Alert.alert(t('auth.login.failedTitle'), t('auth.login.failedMessage'));
          return;
        }

        const idToken = googleResponse.params.id_token;
        if (!idToken || !googleNonce) {
          Alert.alert(t('auth.login.failedTitle'), t('auth.login.failedMessage'));
          return;
        }

        const res = await googleSocialLogin(idToken, googleNonce);

        // Hydrate profile with the new access token — same pattern as handleLogin.
        const { data: profile } = await api.get('/users/me', {
          headers: { Authorization: `Bearer ${res.accessToken}` },
        });

        login(
          {
            publicId: profile.userId,
            email: profile.email,
            firstName: profile.firstName,
            lastName: profile.lastName,
            roles: profile.roles ?? [],
            isOnboardingComplete: profile.isOnboardingComplete ?? null,
            emailConfirmed: res.emailConfirmed ?? profile.emailConfirmed ?? false,
            hasActiveLink: profile.hasActiveLink ?? false,
            hasPendingQuestionnaire: profile.hasPendingQuestionnaire ?? false,
            linkedRoles: profile.linkedRoles ?? [],
            avatarBlobUrl: profile.avatarBlobUrl ?? null,
          },
          res.accessToken,
          res.refreshToken,
        );
      } catch (err: unknown) {
        // 409: email already registered with a password login.
        // Read errorCode from the top-level camelCase field per ProblemDetails wire shape.
        const axiosErr = err as { response?: { data?: { errorCode?: string } } };
        if (axiosErr.response?.data?.errorCode === 'social_email_conflict') {
          Alert.alert(
            t('auth.login.failedTitle'),
            t('auth.login.googleConflict'),
          );
          return;
        }

        // Anything else (401 invalid token/nonce, network error, etc.)
        Alert.alert(t('auth.login.failedTitle'), t('auth.login.failedMessage'));
      } finally {
        setGoogleLoading(false);
        // Refresh the nonce so the next attempt gets a fresh single-use token.
        fetchGoogleNonce();
      }
    };

    handleGoogleResponse();
    // googleNonce, t, login, fetchGoogleNonce are stable or intentionally
    // captured at the time googleResponse was built — only re-run when the
    // response itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleResponse]);

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
        data.refreshToken,
      );
    } catch {
      Alert.alert(t('auth.login.failedTitle'), t('auth.login.failedMessage'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!googleNonce) {
      // Nonce not yet available — try fetching it now before proceeding.
      await fetchGoogleNonce();
      if (!googleNonce) {
        Alert.alert(t('auth.login.failedTitle'), t('auth.login.failedMessage'));
        return;
      }
    }
    setGoogleLoading(true);
    // promptGoogleAsync() opens the browser for the OAuth flow.
    // The result is handled in the useEffect above via googleResponse.
    await promptGoogleAsync();
  };

  const styles = makeStyles(colors);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>
          GoodFellas <Text style={styles.logoAccent}>Platform</Text>
        </Text>
        <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>

        <TextInput
          style={styles.input}
          placeholder={t('auth.login.emailPlaceholder')}
          placeholderTextColor={colors.label3}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder={t('auth.login.passwordPlaceholder')}
          placeholderTextColor={colors.label3}
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
            {loading ? t('auth.login.signingIn') : t('auth.login.signIn')}
          </Text>
        </TouchableOpacity>

        {/* Google Sign-In button — placed below the primary login button */}
        <TouchableOpacity
          style={[styles.socialButton, googleLoading && styles.buttonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
          activeOpacity={0.8}
          accessibilityLabel={t('auth.login.continueWithGoogle')}
        >
          {googleLoading ? (
            <ActivityIndicator
              size="small"
              color={colors.label}
              style={styles.socialIcon}
            />
          ) : (
            <GoogleLogo />
          )}
          <Text style={styles.socialButtonText}>
            {googleLoading
              ? t('auth.login.googleSigningIn')
              : t('auth.login.continueWithGoogle')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/(auth)/register')}
          style={styles.linkRow}
        >
          <Text style={styles.linkText}>
            {t('auth.login.noAccount')}{' '}
            <Text style={styles.linkAccent}>{t('auth.login.signUp')}</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(auth)/forgot-password')}
          style={styles.forgotRow}
          activeOpacity={0.7}
        >
          <Text style={styles.forgotText}>
            {t('auth.login.forgotLink')}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// Inline Google "G" mark using a styled View.
// Google brand colors are required by Google's Identity Branding Guidelines
// (https://developers.google.com/identity/branding-guidelines) — these are
// third-party brand colors, not app design tokens; hardcoding is intentional.
function GoogleLogo() {
  return (
    <View style={googleLogoStyles.container}>
      <Text style={googleLogoStyles.letter}>G</Text>
    </View>
  );
}

const googleLogoStyles = StyleSheet.create({
  container: {
    width: 18,
    height: 18,
    borderRadius: 2,
    backgroundColor: '#ffffff', // Google brand — white background for the G mark
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  letter: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4285F4', // Google brand blue
    lineHeight: 16,
  },
});

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
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
      color: colors.label,
    },
    logoAccent: {
      color: colors.gold,
    },
    subtitle: {
      fontSize: 14,
      marginBottom: 32,
      color: colors.label3,
    },
    input: {
      borderWidth: 1,
      borderRadius: 4,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      marginBottom: 12,
      backgroundColor: colors.bg2,
      borderColor: colors.sep,
      color: colors.label,
    },
    button: {
      borderRadius: 4,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
      backgroundColor: colors.gold,
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
    socialButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 4,
      paddingVertical: 14,
      marginTop: 12,
      backgroundColor: colors.bg2,
      borderWidth: 1,
      borderColor: colors.sep,
    },
    socialIcon: {
      marginRight: 8,
    },
    socialButtonText: {
      color: colors.label,
      fontSize: 14,
      fontWeight: '600',
    },
    forgotRow: {
      marginTop: 14,
      alignItems: 'center',
    },
    forgotText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.gold,
    },
    linkRow: {
      marginTop: 18,
      alignItems: 'center',
    },
    linkText: {
      fontSize: 14,
      color: colors.label3,
    },
    linkAccent: {
      fontWeight: '700',
      color: colors.gold,
    },
  });
