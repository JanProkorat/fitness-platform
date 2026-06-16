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
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin';
import api from '@/api/client';
import { requestSocialNonce, googleSocialLogin } from '@/api/social';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/hooks/useTheme';
import { Colors, type ColorScheme } from '@/constants/colors';

// Configure Google Sign-In once at module level.
// EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID and EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
// are set per-environment — never hardcode OAuth client IDs here.
GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

export default function LoginScreen() {
  const colors = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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
      Alert.alert(t('auth.login.failedTitle'), t('auth.login.failedMessage'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      // Each attempt gets a fresh nonce — nonces are single-use.
      const nonce = await requestSocialNonce();

      await GoogleSignin.hasPlayServices();
      // The @react-native-google-signin/google-signin v16 SDK does not support
      // per-call nonce injection via signIn() — nonce is not in SignInParams.
      // The nonce is still sent in the POST /auth/social/google body; the
      // backend uses it as an anti-replay token and also verifies the idToken
      // nonce claim when present. Follow-up: investigate SDK upgrade or a
      // custom nonce injection path if the backend requires idToken nonce claim.
      const userInfo = await GoogleSignin.signIn();

      const idToken = userInfo.data?.idToken;
      if (!idToken) {
        Alert.alert(t('auth.login.failedTitle'), t('auth.login.failedMessage'));
        return;
      }

      const res = await googleSocialLogin(idToken, nonce);

      // Hydrate the profile with the new access token — same pattern as handleLogin.
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
        res.refreshToken
      );
    } catch (err: unknown) {
      // User cancelled — return to default state silently.
      if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }

      // 409: email already registered with a password login.
      // Read errorCode from the top-level camelCase field per ProblemDetails wire shape.
      const axiosErr = err as { response?: { data?: { errorCode?: string } } };
      if (axiosErr.response?.data?.errorCode === 'social_email_conflict') {
        Alert.alert(
          t('auth.login.failedTitle'),
          t('auth.login.googleConflict')
        );
        return;
      }

      // Anything else (401 invalid token/nonce, network error, etc.)
      Alert.alert(t('auth.login.failedTitle'), t('auth.login.failedMessage'));
    } finally {
      setGoogleLoading(false);
      // Sign out from the Google SDK so the picker shows on the next attempt.
      // This does not revoke the platform tokens.
      await GoogleSignin.signOut();
    }
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

// Inline SVG for the Google logo — no external asset dependency.
function GoogleLogo() {
  // react-native-svg is already a dependency of this project.
  // Using a View with styled children to avoid importing Svg here
  // (Svg is only needed in SVG-heavy components; inline Text is sufficient).
  // We render the standard Google "G" icon as a small coloured square
  // as a platform-agnostic fallback. The real Google "G" multicoloured
  // logo requires react-native-svg; import it when the design team confirms
  // the exact asset path.
  return (
    <View style={googleLogoStyles.container}>
      <Text style={googleLogoStyles.letter}>G</Text>
    </View>
  );
}

// Google brand colors per Google Identity Branding Guidelines.
// These are third-party brand colors, NOT app theme tokens — hardcoding is
// intentional and required to comply with Google's sign-in button appearance
// requirements. See https://developers.google.com/identity/branding-guidelines
// The companion #482 (Apple Sign-In) will follow the same pattern.
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
