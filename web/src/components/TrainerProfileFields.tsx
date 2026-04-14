import { useTranslation } from 'react-i18next';
import { MultiFieldInput } from './MultiFieldInput';

interface TrainerProfileFieldsProps {
  bio: string;
  setBio: (value: string) => void;
  city: string;
  setCity: (value: string) => void;
  estimatedPrice: string;
  setEstimatedPrice: (value: string) => void;
  specializations: string[];
  setSpecializations: (values: string[]) => void;
  certificates: string[];
  setCertificates: (values: string[]) => void;
  languages: string[];
  setLanguages: (values: string[]) => void;
  collaborationType: string;
  setCollaborationType: (value: string) => void;
  maxClients: number;
  setMaxClients: (value: number) => void;
  linkedin: string;
  setLinkedin: (value: string) => void;
  instagram: string;
  setInstagram: (value: string) => void;
  website: string;
  setWebsite: (value: string) => void;
  showInSearch: boolean;
  setShowInSearch: (value: boolean) => void;
  acceptNewClients: boolean;
  setAcceptNewClients: (value: boolean) => void;
}

export function TrainerProfileFields({
  bio,
  setBio,
  city,
  setCity,
  estimatedPrice,
  setEstimatedPrice,
  specializations,
  setSpecializations,
  certificates,
  setCertificates,
  languages,
  setLanguages,
  collaborationType,
  setCollaborationType,
  maxClients,
  setMaxClients,
  linkedin,
  setLinkedin,
  instagram,
  setInstagram,
  website,
  setWebsite,
  showInSearch,
  setShowInSearch,
  acceptNewClients,
  setAcceptNewClients,
}: TrainerProfileFieldsProps) {
  const { t } = useTranslation();

  return (
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
  );
}
