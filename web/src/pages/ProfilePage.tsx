import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { apiClient } from '@/api/client';
import api from '@/lib/api';
import { addRole } from '@/api/roles';
import { PageHeader } from '@/components/layout';
import { useToastStore } from '@/stores/toast';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { QuestionnaireList, QuestionnaireEditor, type QuestionnaireEditorHandle } from '@/components/questionnaire';

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

  type Tab = 'personal' | 'questionnaires';
  const [activeTab, setActiveTab] = useState<Tab>('personal');

  // Questionnaire editor ref + state
  const questionnaireEditorRef = useRef<QuestionnaireEditorHandle>(null);
  const [questionnaireDirty, setQuestionnaireDirty] = useState(false);
  const [questionnaireSaving, setQuestionnaireSaving] = useState(false);
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string | null>(null);

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

        // Fetch phone from user profile
        const userPromise = api.get('/users/me').then(({ data }) => {
          phoneVal = data.phoneNumber ?? '';
          setPhone(phoneVal);
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
  const anyDirty = isDirty || questionnaireDirty;

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
            {((activeTab === 'personal' && isDirty) || (activeTab === 'questionnaires' && questionnaireDirty)) && (
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
                } else {
                  questionnaireEditorRef.current?.save();
                }
              }}
              disabled={
                activeTab === 'personal'
                  ? saving
                  : questionnaireSaving || !questionnaireDirty
              }
              className="rounded-md bg-text px-5 py-2 text-[13px] font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {(activeTab === 'personal' ? saving : questionnaireSaving)
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
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'personal' ? (
        <div className="page-content">
          {/* ── Profile Card (full width) ── */}
          <div className="profile-card">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar">{userInitials}</div>
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
          {isTrainer && user && <RolesSection user={user} setUser={setUser} />}

          {/* ── Trainer-only: two-column layout ── */}
          {isTrainer && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

              {/* ══ LEFT COLUMN ══ */}
              <div>
                {/* Public Profile */}
                <div className="section-heading">
                  {t('profile.publicProfile')}
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-br)' }}
                  >
                    {t('profile.visibleToClients')}
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">{t('profile.bio')}</label>
                  <textarea
                    className="form-input"
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={t('profile.bioPlaceholder')}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t('profile.city')}</label>
                    <input
                      className="form-input"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={t('profile.cityPlaceholder')}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('profile.estimatedPrice')}</label>
                    <input
                      className="form-input"
                      value={estimatedPrice}
                      onChange={(e) => setEstimatedPrice(e.target.value)}
                      placeholder={t('profile.estimatedPricePlaceholder')}
                    />
                  </div>
                </div>

                <div className="divider" />

                {/* Specializations */}
                <div className="form-group">
                  <label className="form-label">{t('profile.specializations')}</label>
                  <MultiFieldInput
                    values={specializations}
                    onChange={setSpecializations}
                    placeholder={t('profile.addSpecialization')}
                  />
                </div>

                {/* Certificates */}
                <div className="form-group">
                  <label className="form-label">{t('profile.certificates')}</label>
                  <MultiFieldInput
                    values={certificates}
                    onChange={setCertificates}
                    placeholder={t('profile.addCertificate')}
                  />
                </div>
              </div>

              {/* ══ RIGHT COLUMN ══ */}
              <div>
                {/* Availability & Preferences */}
                <div className="section-heading">{t('profile.availability')}</div>

                <div className="form-group">
                  <label className="form-label">{t('profile.collaborationType')}</label>
                  <select
                    className="form-select"
                    value={collaborationType}
                    onChange={(e) => setCollaborationType(e.target.value)}
                  >
                    <option value="both">{t('profile.collaborationBoth')}</option>
                    <option value="online">{t('profile.collaborationOnline')}</option>
                    <option value="inperson">{t('profile.collaborationInPerson')}</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t('profile.maxClients')}</label>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      max={200}
                      value={maxClients}
                      onChange={(e) => setMaxClients(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('profile.languages')}</label>
                    <MultiFieldInput
                      values={languages}
                      onChange={setLanguages}
                      placeholder={t('profile.addLanguage')}
                    />
                  </div>
                </div>

                <div className="divider" />

                {/* Social Networks */}
                <div className="section-heading">{t('profile.socialNetworks')}</div>

                <div className="social-row">
                  <div className="social-icon">in</div>
                  <input
                    className="form-input"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    placeholder={t('profile.linkedin')}
                    style={{ flex: 1 }}
                  />
                </div>
                <div className="social-row">
                  <div className="social-icon">ig</div>
                  <input
                    className="form-input"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder={t('profile.instagram')}
                    style={{ flex: 1 }}
                  />
                </div>
                <div className="social-row">
                  <div className="social-icon">🌐</div>
                  <input
                    className="form-input"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder={t('profile.website')}
                    style={{ flex: 1 }}
                  />
                </div>

                <div className="divider" />

                {/* Privacy toggles */}
                <div className="toggle-wrap">
                  <div>
                    <div className="toggle-lbl">{t('profile.showInSearch')}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                      {t('profile.showInSearchDesc')}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`toggle${showInSearch ? ' on' : ''}`}
                    onClick={() => setShowInSearch(!showInSearch)}
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>

                <div className="toggle-wrap" style={{ marginTop: 8 }}>
                  <div>
                    <div className="toggle-lbl">{t('profile.acceptNewClients')}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                      {t('profile.acceptNewClientsDesc')}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`toggle${acceptNewClients ? ' on' : ''}`}
                    onClick={() => setAcceptNewClients(!acceptNewClients)}
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
        ) : (
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

/* ── MultiFieldInput ────────────────────────────────────────────────────────── */

function MultiFieldInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const updateValue = (index: number, value: string) => {
    const next = [...values];
    next[index] = value;
    onChange(next);
  };

  const removeValue = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const addValue = () => {
    onChange([...values, '']);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {values.map((val, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            className="form-input"
            value={val}
            onChange={(e) => updateValue(i, e.target.value)}
            placeholder={placeholder}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => removeValue(i)}
            style={{
              width: 28, height: 28, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              background: 'none', cursor: 'pointer', color: 'var(--text3)',
              fontSize: 13, fontFamily: 'inherit', transition: 'color 0.1s, border-color 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addValue}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '5px 10px', border: '1px dashed var(--border-md)',
          borderRadius: 'var(--radius-md)', background: 'none',
          cursor: 'pointer', color: 'var(--text3)', fontSize: 12,
          fontFamily: 'inherit', transition: 'color 0.1s, border-color 0.1s',
          alignSelf: 'flex-start',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-hv)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.borderColor = 'var(--border-md)'; }}
      >
        + {placeholder}
      </button>
    </div>
  );
}

/* ── RolesSection ──────────────────────────────────────────────────────────── */

function RolesSection({
  user,
  setUser,
}: {
  user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;
  setUser: (u: typeof user) => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasTrainer = user.roles.includes('Trainer');
  const hasNutritionist = user.roles.includes('Nutritionist');
  const canAddRole = !hasTrainer || !hasNutritionist;

  const handleAddRole = async (role: string) => {
    if (!window.confirm(t('profile.addRoleConfirm'))) return;

    setStatus(null);
    setLoading(true);
    try {
      const data = await addRole(role);
      useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);

      const { data: profile } = await api.get('/users/me');
      setUser({
        publicId: profile.userId,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        roles: profile.roles ?? [],
        emailConfirmed: profile.emailConfirmed ?? true,
      });

      setStatus(t('profile.roleAdded'));
    } catch {
      setStatus(t('profile.addRoleError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: 20, padding: '14px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 8 }}>
        {t('profile.rolesTitle')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: canAddRole ? 10 : 0 }}>
        {user.roles.map((role) => (
          <span key={role} className="cert-chip" style={{ background: 'var(--accent-bg)', borderColor: 'var(--accent-br)', color: 'var(--accent)', fontWeight: 500 }}>
            {t(`auth.role${role}`)}
          </span>
        ))}
      </div>
      {canAddRole && (
        <button
          type="button"
          disabled={loading}
          onClick={() => handleAddRole(hasTrainer ? 'Nutritionist' : 'Trainer')}
          className="rounded-md bg-text px-4 py-1.5 text-xs font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading
            ? t('common.saving')
            : hasTrainer
              ? t('profile.addNutritionistRole')
              : t('profile.addTrainerRole')}
        </button>
      )}
      {status && (
        <div style={{ marginTop: 10 }}>
          <StatusMessage status={status} errorKey={t('profile.addRoleError')} />
        </div>
      )}
    </div>
  );
}

/* ── StatusMessage ─────────────────────────────────────────────────────────── */

function StatusMessage({
  status,
  errorKey,
}: {
  status: string | null;
  errorKey: string;
}) {
  if (!status) return null;
  return (
    <div
      className={`mb-4 rounded-sm border px-4 py-2.5 text-sm ${
        status === errorKey
          ? 'border-red bg-red-bg text-red'
          : 'border-green bg-green-bg text-green'
      }`}
    >
      {status}
    </div>
  );
}
