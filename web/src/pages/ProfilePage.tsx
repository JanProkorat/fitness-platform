import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import { PageHeader } from '@/components/layout';
import { useToastStore } from '@/stores/toast';
import { Dialog, Button, EditableAvatar } from '@/components/ui';
import { QuestionnaireList, QuestionnaireEditor, type QuestionnaireEditorHandle } from '@/components/questionnaire';
import { RolesSection } from '@/components/RolesSection';
import { TrainerProfileFields } from '@/components/TrainerProfileFields';
import { WeeklyCheckInTab, type WeeklyCheckInTabHandle } from '@/components/profile/WeeklyCheckInTab';
import {
  requestUserAvatarUploadUrl,
  confirmUserAvatar,
} from '@/api/avatar';

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const isTrainer = user?.roles.some((r) => ['Trainer', 'Nutritionist'].includes(r));

  type Tab = 'personal' | 'questionnaires' | 'weekly-checkins';
  const [activeTab, setActiveTab] = useState<Tab>('personal');

  // Questionnaire editor ref + state
  const questionnaireEditorRef = useRef<QuestionnaireEditorHandle>(null);
  const [questionnaireDirty, setQuestionnaireDirty] = useState(false);
  const [questionnaireSaving, setQuestionnaireSaving] = useState(false);
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string | null>(null);

  // Weekly check-ins ref + state
  const weeklyCheckInRef = useRef<WeeklyCheckInTabHandle>(null);
  const [checkInSaving, setCheckInSaving] = useState(false);
  const [checkInDirty, setCheckInDirty] = useState(false);

  // Personal fields (API-backed)
  const [saving, setSaving] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const schema = z.object({
    firstName: z.string().min(1, t('validation.required')),
    lastName: z.string().min(1, t('validation.required')),
  });

  type PersonalForm = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PersonalForm>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (user) reset({ firstName: user.firstName, lastName: user.lastName });
  }, [user, reset]);

  // Phone (stored on ApplicationUser via Identity)
  const [phone, setPhone] = useState('');

  // Avatar
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  const handleAvatarUploaded = useCallback(async (blobUrl: string) => {
    try {
      await confirmUserAvatar(blobUrl);
      setAvatarSrc(blobUrl);
      // Push the new avatar into the auth store so surfaces that read it
      // (Sidebar user card, etc.) update live without waiting for a full
      // page refresh / restoreSession cycle.
      const current = useAuthStore.getState().user;
      if (current) {
        useAuthStore.getState().setUser({ ...current, avatarBlobUrl: blobUrl });
      }
      addToast(t('avatar.uploadSuccess'), 'success');
    } catch {
      addToast(t('avatar.uploadError'), 'error');
    }
  }, [addToast, t]);

  // Trainer fields (all API-backed)
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [certificates, setCertificates] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [collaborationType, setCollaborationType] = useState('both');
  const [maxClients, setMaxClients] = useState(15);
  const [linkedin, setLinkedin] = useState('');
  const [instagram, setInstagram] = useState('');
  const [website, setWebsite] = useState('');
  const [showInSearch, setShowInSearch] = useState(true);
  const [acceptNewClients, setAcceptNewClients] = useState(true);

  // Snapshot of loaded state for dirty tracking
  const initialState = useRef<string>('');
  const [loaded, setLoaded] = useState(false);

  const getCurrentSnapshot = () => JSON.stringify({
    phone, bio, city, estimatedPrice, specializations, certificates,
    languages, collaborationType, maxClients, linkedin, instagram,
    website, showInSearch, acceptNewClients,
  });

  // Fetch all profile data, then take snapshot and mark as loaded
  useEffect(() => {
    (async () => {
      try {
        let phoneVal = '';
        let bioVal = '';
        let cityVal = '';
        let estimatedPriceVal = '';
        let specializationsVal: string[] = [];
        let certificatesVal: string[] = [];
        let languagesVal: string[] = [];
        let collaborationTypeVal = 'both';
        let maxClientsVal = 15;
        let linkedinVal = '';
        let instagramVal = '';
        let websiteVal = '';
        let showInSearchVal = true;
        let acceptNewClientsVal = true;

        // Fetch phone and avatar from user profile
        const userPromise = api.get('/users/me').then(({ data }) => {
          phoneVal = data.phoneNumber ?? '';
          setPhone(phoneVal);
          setAvatarSrc(data.avatarBlobUrl ?? null);
        }).catch(() => {});

        // Fetch trainer profile (if applicable)
        const trainerPromise = isTrainer
          ? api.get('/trainer/profile').then(({ data }) => {
              bioVal = data.bio ?? '';
              cityVal = data.city ?? '';
              estimatedPriceVal = data.estimatedPrice ?? '';
              specializationsVal = parseJsonArray(data.specializations);
              certificatesVal = parseJsonArray(data.certificates);
              languagesVal = parseJsonArray(data.languages);
              collaborationTypeVal = data.collaborationType ?? 'both';
              maxClientsVal = data.maxClients ?? 15;
              linkedinVal = data.linkedIn ?? '';
              instagramVal = data.instagram ?? '';
              websiteVal = data.website ?? '';
              showInSearchVal = data.showInSearch ?? true;
              acceptNewClientsVal = data.acceptNewClients ?? true;

              setBio(bioVal);
              setCity(cityVal);
              setEstimatedPrice(estimatedPriceVal);
              setSpecializations(specializationsVal);
              setCertificates(certificatesVal);
              setLanguages(languagesVal);
              setCollaborationType(collaborationTypeVal);
              setMaxClients(maxClientsVal);
              setLinkedin(linkedinVal);
              setInstagram(instagramVal);
              setWebsite(websiteVal);
              setShowInSearch(showInSearchVal);
              setAcceptNewClients(acceptNewClientsVal);
            }).catch(() => {})
          : Promise.resolve();

        await Promise.all([userPromise, trainerPromise]);

        // Take snapshot from the fetched values directly, not from React state
        initialState.current = JSON.stringify({
          phone: phoneVal, bio: bioVal, city: cityVal, estimatedPrice: estimatedPriceVal,
          specializations: specializationsVal, certificates: certificatesVal,
          languages: languagesVal, collaborationType: collaborationTypeVal,
          maxClients: maxClientsVal, linkedin: linkedinVal, instagram: instagramVal,
          website: websiteVal, showInSearch: showInSearchVal, acceptNewClients: acceptNewClientsVal,
        });
      } finally {
        setLoaded(true);
      }
    })();
  }, [isTrainer]);

  const isDirty = loaded && getCurrentSnapshot() !== initialState.current;

  // Combined dirty state for navigation guard
  const anyDirty = isDirty || questionnaireDirty || checkInDirty;

  // ── Warn before browser refresh/close ──
  useEffect(() => {
    if (!anyDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [anyDirty]);

  // ── Block in-app navigation when dirty ──
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingNav, setPendingNav] = useState<string | null>(null);

  useEffect(() => {
    if (!anyDirty) return;
    const handler = () => {
      window.history.pushState(null, '', location.pathname + location.search);
      setPendingNav('__back__');
    };
    window.addEventListener('popstate', handler);
    window.history.pushState(null, '', location.pathname + location.search);
    return () => window.removeEventListener('popstate', handler);
  }, [anyDirty, location.pathname, location.search]);

  useEffect(() => {
    if (!anyDirty) return;
    const origPush = window.history.pushState.bind(window.history);
    const currentPath = location.pathname + location.search;
    window.history.pushState = function (...args: Parameters<typeof origPush>) {
      const url = typeof args[2] === 'string' ? args[2] : '';
      if (url && url !== currentPath && !url.startsWith(currentPath + '#')) {
        setPendingNav(url);
        return;
      }
      return origPush(...args);
    };
    return () => { window.history.pushState = origPush; };
  }, [anyDirty, location.pathname, location.search]);

  const confirmLeave = () => {
    const target = pendingNav;
    setPendingNav(null);
    // Reset dirty states to allow navigation
    initialState.current = getCurrentSnapshot();
    setQuestionnaireDirty(false);
    // resetDirty on the handle is required (not just setCheckInDirty(false)):
    // without it, ProfessionBlock's isDirty useEffect re-fires onDirtyChange(true)
    // on the next render because RHF still considers the form dirty.
    weeklyCheckInRef.current?.resetDirty();
    if (target === '__back__') {
      window.history.back();
    } else if (target) {
      navigate(target);
    }
  };

  const onSave = async (data: PersonalForm) => {
    setSaving(true);
    try {
      // Update user profile (name + phone)
      await api.put('/users/me', {
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: phone || null,
      });
      setUser({ ...user!, firstName: data.firstName, lastName: data.lastName });

      // Update trainer/professional profile
      if (isTrainer) {
        await api.put('/trainer/profile', {
          bio: bio || null,
          specialization: specializations.filter(Boolean).join(', ') || null,
          city: city || null,
          estimatedPrice: estimatedPrice || null,
          specializations: JSON.stringify(specializations.filter(Boolean)),
          certificates: JSON.stringify(certificates.filter(Boolean)),
          languages: JSON.stringify(languages.filter(Boolean)),
          collaborationType: collaborationType || null,
          maxClients,
          linkedIn: linkedin || null,
          instagram: instagram || null,
          website: website || null,
          showInSearch,
          acceptNewClients,
        });
      }

      initialState.current = getCurrentSnapshot();
      addToast(t('profile.saved'), 'success');
    } catch {
      addToast(t('profile.saveError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const userInitials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : '??';

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon="👤"
        title={t('sidebar.profile')}
        subtitle={t('profile.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            {((activeTab === 'personal' && isDirty)
              || (activeTab === 'questionnaires' && questionnaireDirty)
              || (activeTab === 'weekly-checkins' && checkInDirty)) && (
              <span style={{ fontSize: 11, color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--orange)' }} />
                {t('profile.unsavedChanges')}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'personal') {
                  handleSubmit(onSave)();
                } else if (activeTab === 'weekly-checkins') {
                  weeklyCheckInRef.current?.save();
                } else {
                  questionnaireEditorRef.current?.save();
                }
              }}
              disabled={
                activeTab === 'personal'
                  ? saving
                  : activeTab === 'weekly-checkins'
                    ? checkInSaving || !checkInDirty
                    : questionnaireSaving || !questionnaireDirty
              }
              className="rounded-md bg-text px-5 py-2 text-[13px] font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {(activeTab === 'personal' ? saving : activeTab === 'weekly-checkins' ? checkInSaving : questionnaireSaving)
                ? t('common.saving')
                : t('common.save')}
            </button>
          </div>
        }
      />

      {/* Toolbar with tabs */}
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <button
          type="button"
          className={`tb-view${activeTab === 'personal' ? ' active' : ''}`}
          onClick={() => setActiveTab('personal')}
        >
          👤 {t('profile.tabPersonal')}
        </button>
        <button
          type="button"
          className={`tb-view${activeTab === 'questionnaires' ? ' active' : ''}`}
          onClick={() => setActiveTab('questionnaires')}
        >
          📋 {t('profile.tabQuestionnaires')}
        </button>
        {isTrainer && (
          <button
            type="button"
            className={`tb-view${activeTab === 'weekly-checkins' ? ' active' : ''}`}
            onClick={() => setActiveTab('weekly-checkins')}
          >
            🔔 {t('weeklyCheckIn.title')}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'personal' ? (
        <div className="page-content">
          {/* ── Profile Card (full width) ── */}
          <div className="profile-card">
            <div className="profile-avatar-wrap">
              <EditableAvatar
                src={avatarSrc}
                initials={userInitials}
                size="lg"
                editable
                requestUploadUrl={(args) =>
                  requestUserAvatarUploadUrl({ contentType: args.contentType, sizeBytes: args.sizeBytes })
                }
                onUploaded={handleAvatarUploaded}
              />
              <div className="profile-avatar-hint" style={{ whiteSpace: 'pre-line' }}>
                {t('profile.changePhoto')}
              </div>
            </div>
            <div className="profile-fields">
              <div className="form-row" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label">{t('profile.firstName')}</label>
                  <input {...register('firstName')} className="form-input" />
                  {errors.firstName && (
                    <p className="mt-1 text-xs text-red">{errors.firstName.message}</p>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">{t('profile.lastName')}</label>
                  <input {...register('lastName')} className="form-input" />
                  {errors.lastName && (
                    <p className="mt-1 text-xs text-red">{errors.lastName.message}</p>
                  )}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t('profile.email')}</label>
                  <input
                    className="form-input"
                    value={user?.email ?? ''}
                    readOnly
                    style={{ opacity: 0.6, cursor: 'default' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('profile.phone')}</label>
                  <input
                    className="form-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+420 777 123 456"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Roles ── */}
          {isTrainer && user && <RolesSection user={user} onRoleAdded={setUser} />}

          {/* ── Trainer-only: two-column layout ── */}
          {isTrainer && (
            <TrainerProfileFields
              bio={bio}
              setBio={setBio}
              city={city}
              setCity={setCity}
              estimatedPrice={estimatedPrice}
              setEstimatedPrice={setEstimatedPrice}
              specializations={specializations}
              setSpecializations={setSpecializations}
              certificates={certificates}
              setCertificates={setCertificates}
              languages={languages}
              setLanguages={setLanguages}
              collaborationType={collaborationType}
              setCollaborationType={setCollaborationType}
              maxClients={maxClients}
              setMaxClients={setMaxClients}
              linkedin={linkedin}
              setLinkedin={setLinkedin}
              instagram={instagram}
              setInstagram={setInstagram}
              website={website}
              setWebsite={setWebsite}
              showInSearch={showInSearch}
              setShowInSearch={setShowInSearch}
              acceptNewClients={acceptNewClients}
              setAcceptNewClients={setAcceptNewClients}
            />
          )}
        </div>
        ) : activeTab === 'questionnaires' ? (
        <div className="page-content">
          {selectedQuestionnaireId ? (
            <QuestionnaireEditor
              key={selectedQuestionnaireId}
              publicId={selectedQuestionnaireId}
              onBack={() => setSelectedQuestionnaireId(null)}
              ref={questionnaireEditorRef}
              onDirtyChange={setQuestionnaireDirty}
              onSavingChange={setQuestionnaireSaving}
            />
          ) : (
            <QuestionnaireList onSelect={setSelectedQuestionnaireId} />
          )}
        </div>
        ) : (
          <WeeklyCheckInTab
            ref={weeklyCheckInRef}
            roles={user?.roles ?? []}
            onSavingChange={setCheckInSaving}
            onDirtyChange={setCheckInDirty}
          />
        )}
      </div>

      {/* ── Leave Page Confirmation Dialog ── */}
      <Dialog
        open={!!pendingNav}
        onClose={() => setPendingNav(null)}
        title={t('profile.leaveTitle')}
        maxWidth={400}
        footer={
          <>
            <Button onClick={() => setPendingNav(null)}>{t('profile.stay')}</Button>
            <Button variant="danger" onClick={confirmLeave}>
              {t('profile.leaveWithoutSaving')}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          {t('profile.leaveMessage')}
        </p>
      </Dialog>
    </div>
  );
}

