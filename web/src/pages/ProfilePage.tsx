import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
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
import {
  getMyProfile,
  updateMyProfile,
  getTrainerProfile,
  updateTrainerProfile,
  profileKeys,
} from '@/api/profile';

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

  // Personal fields (API-backed) — `saving` is derived below from saveMutation.
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

  // Snapshot of loaded state for dirty tracking. Deliberately a state value
  // (not a ref) — reading a ref's `.current` during render is a lint error
  // under this project's React Compiler config (react-hooks/refs); `isDirty`
  // below needs to compare against this baseline on every render.
  const [initialSnapshot, setInitialSnapshot] = useState('');
  // Guards the hydration block below so it only seeds local edit state once
  // per query settle — useQuery re-renders on every refetch/invalidate, and
  // re-hydrating on those would stomp in-progress edits. `null` (not `false`)
  // so the guard matches the `ref.current == null` pattern this project's
  // react-hooks/refs lint rule requires for a ref read during render.
  const hydratedRef = useRef<true | null>(null);

  const getCurrentSnapshot = () => JSON.stringify({
    phone, bio, city, estimatedPrice, specializations, certificates,
    languages, collaborationType, maxClients, linkedin, instagram,
    website, showInSearch, acceptNewClients,
  });

  const queryClient = useQueryClient();

  const userQuery = useQuery({
    queryKey: profileKeys.me,
    queryFn: getMyProfile,
  });

  const trainerQuery = useQuery({
    queryKey: profileKeys.trainer,
    queryFn: getTrainerProfile,
    enabled: Boolean(isTrainer),
  });

  useEffect(() => {
    if (userQuery.isError) {
      addToast(t('profile.loadError'), 'error');
    }
  }, [userQuery.isError, addToast, t]);

  useEffect(() => {
    if (trainerQuery.isError) {
      addToast(t('profile.trainerProfileLoadError'), 'error');
    }
  }, [trainerQuery.isError, addToast, t]);

  // `isFetched` flips to true after the first settle (success OR error) —
  // mirrors the previous fetch effect's `finally { setLoaded(true) }`, which
  // marked the page ready for dirty-tracking regardless of per-request errors.
  const loaded = userQuery.isFetched && (!isTrainer || trainerQuery.isFetched);

  // Hydrate local edit state + take the initial dirty-tracking snapshot once
  // both queries have settled. Local state (not the query cache) backs the
  // controlled inputs below, so edits don't get overwritten by background
  // refetches.
  //
  // Deliberately done during render (React's "adjusting state when a prop
  // changes" pattern — see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // rather than in a useEffect: calling several setState functions inside an
  // effect body is flagged by this project's react-hooks/set-state-in-effect
  // rule (cascading-render risk). Guarding with `hydratedRef` keeps this to a
  // single pass — React re-renders immediately with the updated state before
  // committing, so there's no visible flash.
  if (hydratedRef.current == null) {
    if (loaded) {
      hydratedRef.current = true;

      const u = userQuery.data;
      const tp = trainerQuery.data;

      const phoneVal = u?.phoneNumber ?? '';
      const bioVal = tp?.bio ?? '';
      const cityVal = tp?.city ?? '';
      const estimatedPriceVal = tp?.estimatedPrice ?? '';
      const specializationsVal = parseJsonArray(tp?.specializations);
      const certificatesVal = parseJsonArray(tp?.certificates);
      const languagesVal = parseJsonArray(tp?.languages);
      const collaborationTypeVal = tp?.collaborationType ?? 'both';
      const maxClientsVal = tp?.maxClients ?? 15;
      const linkedinVal = tp?.linkedIn ?? '';
      const instagramVal = tp?.instagram ?? '';
      const websiteVal = tp?.website ?? '';
      const showInSearchVal = tp?.showInSearch ?? true;
      const acceptNewClientsVal = tp?.acceptNewClients ?? true;

      setPhone(phoneVal);
      setAvatarSrc(u?.avatarBlobUrl ?? null);
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

      setInitialSnapshot(JSON.stringify({
        phone: phoneVal, bio: bioVal, city: cityVal, estimatedPrice: estimatedPriceVal,
        specializations: specializationsVal, certificates: certificatesVal,
        languages: languagesVal, collaborationType: collaborationTypeVal,
        maxClients: maxClientsVal, linkedin: linkedinVal, instagram: instagramVal,
        website: websiteVal, showInSearch: showInSearchVal, acceptNewClients: acceptNewClientsVal,
      }));
    }
  }

  const isDirty = loaded && getCurrentSnapshot() !== initialSnapshot;

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

  // Single effect covering both in-app navigation vectors — back/forward
  // (popstate) and programmatic navigation (react-router's <Link>/navigate(),
  // which goes through history.pushState). These previously lived in two
  // separate effects with identical deps and both funneled into
  // `setPendingNav`; consolidated into one registration/cleanup pair (#687).
  useEffect(() => {
    if (!anyDirty) return;
    const currentPath = location.pathname + location.search;

    const onPopState = () => {
      window.history.pushState(null, '', currentPath);
      setPendingNav('__back__');
    };
    window.addEventListener('popstate', onPopState);
    window.history.pushState(null, '', currentPath);

    const origPush = window.history.pushState.bind(window.history);
    window.history.pushState = function (...args: Parameters<typeof origPush>) {
      const url = typeof args[2] === 'string' ? args[2] : '';
      if (url && url !== currentPath && !url.startsWith(currentPath + '#')) {
        setPendingNav(url);
        return;
      }
      return origPush(...args);
    };

    return () => {
      window.removeEventListener('popstate', onPopState);
      window.history.pushState = origPush;
    };
  }, [anyDirty, location.pathname, location.search]);

  const confirmLeave = () => {
    const target = pendingNav;
    setPendingNav(null);
    // Reset dirty states to allow navigation
    setInitialSnapshot(getCurrentSnapshot());
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

  const saveMutation = useMutation({
    mutationFn: async (data: PersonalForm) => {
      // Update user profile (name + phone)
      await updateMyProfile({
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: phone || null,
      });

      // Update trainer/professional profile
      if (isTrainer) {
        await updateTrainerProfile({
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
    },
    onSuccess: (_result, data) => {
      setUser({ ...user!, firstName: data.firstName, lastName: data.lastName });
      setInitialSnapshot(getCurrentSnapshot());
      addToast(t('profile.saved'), 'success');
      queryClient.invalidateQueries({ queryKey: profileKeys.me });
      if (isTrainer) {
        queryClient.invalidateQueries({ queryKey: profileKeys.trainer });
      }
    },
    onError: () => {
      addToast(t('profile.saveError'), 'error');
    },
  });

  const onSave = (data: PersonalForm) => saveMutation.mutate(data);
  const saving = saveMutation.isPending;

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
                  <label htmlFor="profile-first-name" className="form-label">{t('profile.firstName')}</label>
                  <input id="profile-first-name" {...register('firstName')} className="form-input" />
                  {errors.firstName && (
                    <p className="mt-1 text-xs text-red">{errors.firstName.message}</p>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="profile-last-name" className="form-label">{t('profile.lastName')}</label>
                  <input id="profile-last-name" {...register('lastName')} className="form-input" />
                  {errors.lastName && (
                    <p className="mt-1 text-xs text-red">{errors.lastName.message}</p>
                  )}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="profile-email" className="form-label">{t('profile.email')}</label>
                  <input
                    id="profile-email"
                    className="form-input"
                    value={user?.email ?? ''}
                    readOnly
                    style={{ opacity: 0.6, cursor: 'default' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="profile-phone" className="form-label">{t('profile.phone')}</label>
                  <input
                    id="profile-phone"
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

