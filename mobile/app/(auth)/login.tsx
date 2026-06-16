import { useState, useEffect, useCallback, useRef } from 'react';
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
import * as AppleAuthentication from 'expo-apple-authentication';
import axios from 'axios';
import api from '@/api/client';
import { requestSocialNonce, googleSocialLogin, appleSocialLogin } from '@/api/social';
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
  const [appleLoading, setAppleLoading] = useState(false);
  // Whether Apple Sign In is available on this device (iOS only).
  const [appleAvailable, setAppleAvailable] = useState(false);

  // Server-issued nonce for the current Google sign-in attempt.
  // Fetched on mount and refreshed after each attempt (nonces are single-use).
  const [googleNonce, setGoogleNonce] = useState<string | null>(null);

  // Holds the exact nonce that was embedded in the in-flight promptGoogleAsync
  // request. We capture it into a ref at prompt time so the success handler
  // always sends the nonce that matches the id_token — even if googleNonce
  // state was refreshed between the prompt and the response.
  const inflightNonceRef = useRef<string | null>(null);

  // Returns the nonce string as well as setting state so callers can act on
  // the value immediately without waiting for a re-render.
  const fetchGoogleNonce = useCallback(async (): Promise<string | null> => {
    try {
      const nonce = await requestSocialNonce();
      setGoogleNonce(nonce);
      return nonce;
    } catch {
      // Silent fail — the nonce will be re-fetched on the next attempt if needed.
      setGoogleNonce(null);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchGoogleNonce();
  }, [fetchGoogleNonce]);

  // Check Apple Sign In availability on mount (iOS only — always false on Android/web).
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

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
        // Read the nonce that was embedded in THIS prompt's request from the
        // ref, not from googleNonce state. State may have been refreshed
        // between when promptGoogleAsync built the request and now.
        const nonceForThisAttempt = inflightNonceRef.current;
        if (!idToken || !nonceForThisAttempt) {
          Alert.alert(t('auth.login.failedTitle'), t('auth.login.failedMessage'));
          return;
        }

        const res = await googleSocialLogin(idToken, nonceForThisAttempt);

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
        if (axios.isAxiosError(err) && err.response?.data?.errorCode === 'social_email_conflict') {
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
        inflightNonceRef.current = null;
        // Refresh the nonce so the next attempt gets a fresh single-use token.
        fetchGoogleNonce();
      }
    };

    handleGoogleResponse();
  }, [googleResponse, t, login, fetchGoogleNonce]);

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
    // Use the current nonce from state, or fetch a fresh one if not yet available.
    // fetchGoogleNonce() returns the value directly so we don't read stale state.
    const currentNonce = googleNonce ?? (await fetchGoogleNonce());
    if (!currentNonce) {
      Alert.alert(t('auth.login.failedTitle'), t('auth.login.failedMessage'));
      return;
    }
    // Capture the nonce used for this specific prompt so the response handler
    // can send the exact nonce embedded in the id_token regardless of later
    // state updates.
    inflightNonceRef.current = currentNonce;
    setGoogleLoading(true);
    // promptGoogleAsync() opens the browser for the OAuth flow.
    // The result is handled in the useEffect above via googleResponse.
    await promptGoogleAsync();
  };

  const handleAppleSignIn = async () => {
    // Guard against concurrent auth flows.
    if (loading || googleLoading || appleLoading) return;
    // Fetch a fresh single-use nonce from the backend before opening the Apple sheet.
    // The raw nonce is passed to Apple; Apple embeds SHA-256(rawNonce) in the
    // identity token. The backend receives the raw nonce and hashes it for comparison.
    let rawNonce: string;
    try {
      rawNonce = await requestSocialNonce();
    } catch {
      Alert.alert(t('auth.login.failedTitle'), t('auth.login.failedMessage'));
      return;
    }

    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: rawNonce,
      });

      if (!credential.identityToken) {
        Alert.alert(t('auth.login.failedTitle'), t('auth.login.failedMessage'));
        return;
      }

      const res = await appleSocialLogin({
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode,
        // firstName/lastName are only present on the first authorization for
        // this device/app pair. null is fine — the backend (#480) handles it.
        firstName: credential.fullName?.givenName ?? null,
        lastName: credential.fullName?.familyName ?? null,
        nonce: rawNonce,
      });

      // Hydrate profile with the new access token — same pattern as handleLogin
      // and handleGoogleResponse.
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
      // User cancelled the native Apple sign-in sheet — return silently.
      if (
        err instanceof Error &&
        'code' in err &&
        (err as { code: string }).code === 'ERR_REQUEST_CANCELED'
      ) {
        return;
      }

      // 409: email already registered with a password login.
      if (axios.isAxiosError(err) && err.response?.data?.errorCode === 'social_email_conflict') {
        Alert.alert(
          t('auth.login.failedTitle'),
          t('auth.login.appleConflict'),
        );
        return;
      }

      // Anything else (401 invalid token/nonce, network error, etc.)
      Alert.alert(t('auth.login.failedTitle'), t('auth.login.failedMessage'));
    } finally {
      setAppleLoading(false);
    }
  };

  // Combined guard: disable all auth buttons while any login is in flight.
  const busy = loading || googleLoading || appleLoading;

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
          disabled={busy}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {loading ? t('auth.login.signingIn') : t('auth.login.signIn')}
          </Text>
        </TouchableOpacity>

        {/* Google Sign-In button — placed below the primary login button.
            Disabled while loading or while the nonce prefetch is in flight
            (googleNonce === null) to prevent a prompt with no nonce. */}
        <TouchableOpacity
          style={[styles.socialButton, (busy || googleNonce === null) && styles.buttonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={busy || googleNonce === null}
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

        {/* Apple Sign In — iOS only, shown only when the native capability is
            available. Uses the native AppleAuthenticationButton which renders
            Apple-approved chrome automatically. Must not be re-skinned.
            buttonStyle is theme-aware: WHITE on dark backgrounds so the button
            remains visible against the dark bg, BLACK on light backgrounds.
            Disabled while any auth flow is in flight. */}
        {appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={
              colors === Colors.dark
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={4}
            style={[styles.appleButton, busy && styles.buttonDisabled]}
            onPress={handleAppleSignIn}
            accessibilityLabel={t('auth.login.continueWithApple')}
          />
        )}

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
    // AppleAuthenticationButton requires an explicit width + height per the SDK.
    // We match the Google socialButton height so both buttons align consistently.
    appleButton: {
      width: '100%',
      height: 50,
      marginTop: 12,
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
