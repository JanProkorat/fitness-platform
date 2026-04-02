import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Linking,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../../constants/Colors';
import {
  getProfessionalProfile,
  sendClientRequest,
  type ProfessionalProfile,
} from '../../src/api/professionals';

const ROLE_LABELS: Record<string, string> = {
  Trainer: 'Trener',
  Nutritionist: 'Vyživovy poradce',
  PhysioTherapist: 'Fyzioterapeut',
};

export default function ProfessionalProfileScreen() {
  const { professionalId } = useLocalSearchParams<{ professionalId: string }>();
  const queryClient = useQueryClient();
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');

  const { data: profile, isLoading } = useQuery<ProfessionalProfile>({
    queryKey: ['professional', professionalId],
    queryFn: () => getProfessionalProfile(professionalId),
    enabled: !!professionalId,
  });

  const requestMutation = useMutation({
    mutationFn: () =>
      sendClientRequest(professionalId, requestMessage.trim() || undefined),
    onSuccess: () => {
      setShowRequestModal(false);
      setRequestMessage('');
      queryClient.invalidateQueries({ queryKey: ['professional', professionalId] });
      Alert.alert('Odeslano', 'Vase zadost byla odeslana.');
    },
    onError: () => {
      Alert.alert('Chyba', 'Nepodarilo se odeslat zadost. Zkuste to znovu.');
    },
  });

  const handleSendRequest = useCallback(() => {
    requestMutation.mutate();
  }, [requestMutation]);

  const openLink = useCallback((url: string) => {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(fullUrl).catch(() => {
      Alert.alert('Chyba', 'Nepodarilo se otevrit odkaz.');
    });
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.dark.gold} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>😕</Text>
          <Text style={styles.emptyText}>Profil nebyl nalezen.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isPending = profile.hasPendingRequest;
  const isLinked = profile.isLinked;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {profile.firstName[0]}
              {profile.lastName[0]}
            </Text>
          </View>
          <Text style={styles.profileName}>
            {profile.firstName} {profile.lastName}
          </Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {(profile.roles ?? []).map(r => ROLE_LABELS[r] ?? r).join(' · ')}
            </Text>
          </View>
        </View>

        {/* Bio */}
        {profile.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>O mne</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* Specializations */}
        {profile.specializations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Specializace</Text>
            <View style={styles.tagsRow}>
              {profile.specializations.map((spec) => (
                <View key={spec} style={styles.tag}>
                  <Text style={styles.tagText}>{spec}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Certificates */}
        {profile.certificates.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Certifikaty</Text>
            <View style={styles.tagsRow}>
              {profile.certificates.map((cert) => (
                <View key={cert} style={[styles.tag, styles.certTag]}>
                  <Text style={styles.certTagText}>{cert}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Info rows */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informace</Text>
          <View style={styles.infoCard}>
            {profile.city && (
              <InfoRow label="Mesto" value={profile.city} />
            )}
            {profile.estimatedPrice && (
              <InfoRow label="Cena" value={profile.estimatedPrice} />
            )}
            {profile.collaborationType && (
              <InfoRow label="Spoluprace" value={profile.collaborationType} />
            )}
            {profile.languages.length > 0 && (
              <InfoRow
                label="Jazyky"
                value={profile.languages.join(', ')}
                isLast
              />
            )}
          </View>
        </View>

        {/* Social links */}
        {(profile.linkedIn || profile.instagram || profile.website) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Odkazy</Text>
            <View style={styles.infoCard}>
              {profile.linkedIn && (
                <TouchableOpacity
                  style={styles.linkRow}
                  onPress={() => openLink(profile.linkedIn!)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.linkIcon}>🔗</Text>
                  <Text style={styles.linkLabel}>LinkedIn</Text>
                  <Text style={styles.linkArrow}>→</Text>
                </TouchableOpacity>
              )}
              {profile.instagram && (
                <TouchableOpacity
                  style={styles.linkRow}
                  onPress={() => openLink(`https://instagram.com/${profile.instagram}`)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.linkIcon}>📸</Text>
                  <Text style={styles.linkLabel}>Instagram</Text>
                  <Text style={styles.linkArrow}>→</Text>
                </TouchableOpacity>
              )}
              {profile.website && (
                <TouchableOpacity
                  style={[styles.linkRow, styles.linkRowLast]}
                  onPress={() => openLink(profile.website!)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.linkIcon}>🌐</Text>
                  <Text style={styles.linkLabel}>Web</Text>
                  <Text style={styles.linkArrow}>→</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Spacer for bottom button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom action button */}
      {!isLinked && (
        <View style={styles.bottomBar}>
          {isPending ? (
            <View style={[styles.actionButton, styles.actionButtonDisabled]}>
              <Text style={styles.actionButtonTextDisabled}>
                Zadost odeslana
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.actionButton}
              activeOpacity={0.8}
              onPress={() => setShowRequestModal(true)}
            >
              <Text style={styles.actionButtonText}>Odeslat zadost</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isLinked && (
        <View style={styles.bottomBar}>
          <View style={[styles.actionButton, styles.actionButtonLinked]}>
            <Text style={styles.actionButtonTextLinked}>Jiz propojeni</Text>
          </View>
        </View>
      )}

      {/* Request modal */}
      <Modal
        visible={showRequestModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRequestModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowRequestModal(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={() => {}}
          >
            <Text style={styles.modalTitle}>Odeslat zadost</Text>
            <Text style={styles.modalSubtitle}>
              Muzete pridat zpravu pro {profile.firstName} (volitelne).
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Napiste zpravu..."
              placeholderTextColor={Colors.dark.text3}
              value={requestMessage}
              onChangeText={setRequestMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowRequestModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Zrusit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSendBtn}
                onPress={handleSendRequest}
                activeOpacity={0.8}
                disabled={requestMutation.isPending}
              >
                {requestMutation.isPending ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.modalSendText}>Odeslat</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.text3,
    marginTop: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.dark.surface,
    borderWidth: 2,
    borderColor: Colors.dark.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.gold,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: 'rgba(200, 169, 78, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.text3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  bioText: {
    fontSize: 14,
    color: Colors.dark.text2,
    lineHeight: 22,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.dark.text2,
  },
  certTag: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  certTagText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.dark.green,
  },
  infoCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.dark.text3,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: Colors.dark.text,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  linkRowLast: {
    borderBottomWidth: 0,
  },
  linkIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  linkLabel: {
    fontSize: 13,
    color: Colors.dark.text,
    fontWeight: '500',
    flex: 1,
  },
  linkArrow: {
    fontSize: 14,
    color: Colors.dark.text3,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
    backgroundColor: Colors.dark.background,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  actionButton: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  actionButtonDisabled: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  actionButtonTextDisabled: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text3,
  },
  actionButtonLinked: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  actionButtonTextLinked: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.green,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.dark.text3,
    marginBottom: 16,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.dark.text,
    minHeight: 100,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text2,
  },
  modalSendBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.dark.gold,
    alignItems: 'center',
  },
  modalSendText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
});
