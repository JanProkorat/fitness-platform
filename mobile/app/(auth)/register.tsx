import { useEffect, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import api from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/hooks/useTheme';
import { Colors } from '@/constants/colors';

const CLIENT_ROLE = 'Client' as const;
const COACH_ROLES = ['Trainer', 'Nutritionist'] as const;
const ROLES = [CLIENT_ROLE, ...COACH_ROLES] as const;
type RoleName = (typeof ROLES)[number];

const ROLE_META: Record<RoleName, { icon: string; labelKey: string; descKey: string }> = {
  Client: { icon: '👤', labelKey: 'auth.register.roleClient', descKey: 'auth.register.roleClientDesc' },
  Trainer: { icon: '🏋️', labelKey: 'auth.register.roleTrainer', descKey: 'auth.register.roleTrainerDesc' },
  Nutritionist: { icon: '🥗', labelKey: 'auth.register.roleNutritionist', descKey: 'auth.register.roleNutritionistDesc' },
};

export default function RegisterScreen() {
  const colors = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const login = useAuthStore((s) => s.login);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<Set<RoleName>>(new Set([CLIENT_ROLE]));
  const [personalDataConsent, setPersonalDataConsent] = useState(false);
  const [healthDataConsent, setHealthDataConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  const isClientSelected = selectedRoles.has(CLIENT_ROLE);

  // Health-data consent is only interactive (and only meaningful) for the
  // Client role. Whenever Client stops being selected, force the checkbox
  // back to unchecked so a stale `true` can never leak into a coach payload.
  useEffect(() => {
    if (!isClientSelected && healthDataConsent) {
      setHealthDataConsent(false);
    }
  }, [isClientSelected, healthDataConsent]);

  const toggleRole = (r: RoleName) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (r === CLIENT_ROLE) {
        if (next.has(CLIENT_ROLE)) {
          next.delete(CLIENT_ROLE);
        } else {
          next.clear();
          next.add(CLIENT_ROLE);
        }
      } else {
        if (next.has(r)) {
          next.delete(r);
        } else {
          next.delete(CLIENT_ROLE);
          next.add(r);
        }
      }
      return next;
    });
  };

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      Alert.alert(t('auth.register.missingFieldsTitle'), t('auth.register.missingFieldsMessage'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('auth.register.mismatchTitle'), t('auth.register.mismatchMessage'));
      return;
    }
    if (password.length < 8) {
      Alert.alert(t('auth.register.weakPasswordTitle'), t('auth.register.weakPasswordMessage'));
      return;
    }
    if (!personalDataConsent) {
      Alert.alert(t('auth.register.consentRequiredTitle'), t('auth.register.consentRequiredMessage'));
      return;
    }
    if (selectedRoles.size === 0) {
      Alert.alert(t('auth.register.noRoleTitle'), t('auth.register.noRoleMessage'));
      return;
    }
    if (isClientSelected && !healthDataConsent) {
      Alert.alert(t('auth.register.consentRequiredTitle'), t('auth.register.healthDataConsentRequiredMessage'));
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
        roles: Array.from(selectedRoles),
        gdprConsent: true,
        healthDataConsent: isClientSelected ? true : undefined,
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
          avatarBlobUrl: profile.avatarBlobUrl ?? null,
        },
        data.accessToken,
        data.refreshToken
      );
    } catch (e: unknown) {
      const data = axios.isAxiosError(e)
        ? (e.response?.data as { errors?: { generalErrors?: string[] }; message?: string } | undefined)
        : undefined;
      const msg =
        data?.errors?.generalErrors?.[0] ??
        data?.message ??
        t('auth.register.failedMessage');
      Alert.alert(t('auth.register.failedTitle'), msg);
    } finally {
      setLoading(false);
    }
  };

  const renderRoleCard = (r: RoleName, indicator: 'radio' | 'checkbox') => {
    const meta = ROLE_META[r];
    const active = selectedRoles.has(r);
    return (
      <TouchableOpacity
        key={r}
        style={[
          styles.roleCard,
          { backgroundColor: active ? colors.gold : colors.bg2, borderColor: active ? colors.gold : colors.sep },
        ]}
        onPress={() => toggleRole(r)}
        activeOpacity={0.8}
      >
        <View style={[styles.roleIconWrap, { backgroundColor: active ? 'rgba(0,0,0,0.12)' : colors.bg3 }]}>
          <Text style={styles.roleIcon}>{meta.icon}</Text>
        </View>
        <View style={styles.roleTextWrap}>
          <Text style={[styles.roleName, { color: active ? Colors.light.onGoldChip : colors.label }]}>
            {t(meta.labelKey)}
          </Text>
          <Text style={[styles.roleDesc, { color: active ? 'rgba(0,0,0,0.7)' : colors.label3 }]}>
            {t(meta.descKey)}
          </Text>
        </View>
        {indicator === 'radio' ? (
          <View style={[styles.roleRadio, { borderColor: active ? Colors.light.onGoldChip : colors.sep }]}>
            {active && <View style={[styles.roleRadioDot, { backgroundColor: Colors.light.onGoldChip }]} />}
          </View>
        ) : (
          <View
            style={[
              styles.roleCheckbox,
              { borderColor: active ? Colors.light.onGoldChip : colors.sep },
              active && { backgroundColor: Colors.light.onGoldChip },
            ]}
          >
            {active && <Text style={[styles.roleCheckboxMark, { color: colors.gold }]}>✓</Text>}
          </View>
        )}
      </TouchableOpacity>
    );
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
        <Text style={[styles.subtitle, { color: colors.label3 }]}>{t('auth.register.subtitle')}</Text>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.halfInput, { backgroundColor: colors.bg2, borderColor: colors.sep, color: colors.label }]}
            placeholder={t('auth.register.firstNamePlaceholder')}
            placeholderTextColor={colors.label3}
            value={firstName}
            onChangeText={setFirstName}
            autoComplete="given-name"
          />
          <TextInput
            style={[styles.input, styles.halfInput, { backgroundColor: colors.bg2, borderColor: colors.sep, color: colors.label }]}
            placeholder={t('auth.register.lastNamePlaceholder')}
            placeholderTextColor={colors.label3}
            value={lastName}
            onChangeText={setLastName}
            autoComplete="family-name"
          />
        </View>

        <TextInput
          style={[styles.input, { backgroundColor: colors.bg2, borderColor: colors.sep, color: colors.label }]}
          placeholder={t('auth.register.emailPlaceholder')}
          placeholderTextColor={colors.label3}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.bg2, borderColor: colors.sep, color: colors.label }]}
          placeholder={t('auth.register.passwordPlaceholder')}
          placeholderTextColor={colors.label3}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.bg2, borderColor: colors.sep, color: colors.label }]}
          placeholder={t('auth.register.confirmPasswordPlaceholder')}
          placeholderTextColor={colors.label3}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        <Text style={[styles.label, { color: colors.label2 }]}>{t('auth.register.iAmA')}</Text>

        {/* Client sits in its own mutually-exclusive group — selecting it
            clears any selected coach role and vice versa (see toggleRole). */}
        <View style={styles.roleStack}>
          {renderRoleCard(CLIENT_ROLE, 'radio')}
        </View>

        <Text style={[styles.roleOrHint, { color: colors.label3 }]}>{t('auth.register.roleOrHint')}</Text>
        <Text style={[styles.roleCoachHint, { color: colors.label3 }]}>{t('auth.register.roleCoachHint')}</Text>

        {/* Trainer + Nutritionist support multi-select — square checkbox
            indicators communicate that both can be active together. */}
        <View style={styles.roleStack}>
          {COACH_ROLES.map((r) => renderRoleCard(r, 'checkbox'))}
        </View>

        <Text style={[styles.roleExclusivityHint, { color: colors.label3 }]}>
          {t('auth.register.roleExclusivityHint')}
        </Text>

        <TouchableOpacity
          style={styles.consentRow}
          onPress={() => setPersonalDataConsent(!personalDataConsent)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, { borderColor: colors.sep, backgroundColor: colors.bg2 }, personalDataConsent && [styles.checkboxChecked, { backgroundColor: colors.gold, borderColor: colors.gold }]]}>
            {personalDataConsent && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[styles.consentText, { color: colors.label2 }]}>
            {t('auth.register.gdprConsent')}
          </Text>
        </TouchableOpacity>

        {/* Always rendered — never conditionally mounted — so switching
            roles never causes a layout jump. Only interactive when Client
            is selected; disabled + visually muted for coach-only selection. */}
        <TouchableOpacity
          style={styles.consentRow}
          onPress={() => isClientSelected && setHealthDataConsent(!healthDataConsent)}
          activeOpacity={isClientSelected ? 0.8 : 1}
          disabled={!isClientSelected}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: isClientSelected ? colors.sep : colors.sep2,
                backgroundColor: isClientSelected ? colors.bg2 : colors.fill2,
              },
              isClientSelected && healthDataConsent && [
                styles.checkboxChecked,
                { backgroundColor: colors.gold, borderColor: colors.gold },
              ],
            ]}
          >
            {isClientSelected && healthDataConsent && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[styles.consentText, { color: isClientSelected ? colors.label2 : colors.label3 }]}>
            {t('auth.register.healthDataConsent')}
          </Text>
        </TouchableOpacity>
        {!isClientSelected && (
          <Text style={[styles.consentHint, { color: colors.label3 }]}>
            {t('auth.register.healthDataConsentDisabledHint')}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.gold }, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {loading ? t('auth.register.creating') : t('auth.register.create')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/(auth)/login')}
          style={styles.linkRow}
        >
          <Text style={[styles.linkText, { color: colors.label3 }]}>
            {t('auth.register.haveAccount')}{' '}
            <Text style={[styles.linkAccent, { color: colors.gold }]}>{t('auth.register.signIn')}</Text>
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
    paddingHorizontal: 24,
    paddingVertical: 16,
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
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 2,
  },
  roleStack: {
    flexDirection: 'column',
    gap: 6,
    marginBottom: 12,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIcon: {
    fontSize: 17,
  },
  roleTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  roleName: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  roleDesc: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
  },
  roleRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  roleCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCheckboxMark: {
    fontSize: 12,
    fontWeight: '800',
  },
  roleOrHint: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  roleCoachHint: {
    fontSize: 11,
    lineHeight: 14,
    marginBottom: 6,
  },
  roleExclusivityHint: {
    fontSize: 11,
    lineHeight: 14,
    marginBottom: 12,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  consentHint: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: -8,
    marginBottom: 12,
    marginLeft: 30,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {},
  checkmark: {
    color: Colors.light.onGoldChip,
    fontSize: 13,
    fontWeight: '800',
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  button: {
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
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
  linkRow: {
    marginTop: 14,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 13,
  },
  linkAccent: {
    fontWeight: '700',
  },
});
