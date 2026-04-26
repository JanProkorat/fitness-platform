import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineChipsInput } from './InlineChipsInput';

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

const BIO_MAX = 500;

const cardStyle: CSSProperties = {
  background: 'var(--bg2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '16px 18px',
};

const innerRowStyle: CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '10px 12px',
};

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
    <>
      {/* ══ Block A — Section title + 2-col grid (Bio | Basics) ══ */}
      <div
        className="section-heading"
        style={{ marginBottom: 12 }}
      >
        {t('profile.publicProfile')}
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{
            background: 'var(--accent-bg)',
            color: 'var(--accent)',
            border: '1px solid var(--accent-br)',
          }}
        >
          {t('profile.visibleToClients')}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
          marginBottom: 14,
        }}
      >
        {/* Bio card */}
        <div style={cardStyle}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('profile.bio')}</label>
            <textarea
              className="form-input"
              rows={4}
              maxLength={BIO_MAX}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('profile.bioPlaceholder')}
            />
            <div
              style={{
                fontSize: 11,
                color: 'var(--text3)',
                marginTop: 4,
              }}
            >
              {bio.length} / {BIO_MAX} {t('profile.characters')}
            </div>
          </div>
        </div>

        {/* Basics card */}
        <div style={cardStyle}>
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
          <div className="form-group" style={{ marginBottom: 0 }}>
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
        </div>
      </div>

      {/* ══ Block B — Chips card (Specializations / Certificates / Languages) ══ */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div className="form-group">
          <label className="form-label">{t('profile.specializations')}</label>
          <InlineChipsInput
            values={specializations}
            onChange={setSpecializations}
            placeholder={t('profile.addSpecialization')}
            colorScheme="gold"
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t('profile.certificates')}</label>
          <InlineChipsInput
            values={certificates}
            onChange={setCertificates}
            placeholder={t('profile.addCertificate')}
            colorScheme="green"
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">{t('profile.languages')}</label>
          <InlineChipsInput
            values={languages}
            onChange={setLanguages}
            placeholder={t('profile.addLanguage')}
            colorScheme="gray"
          />
        </div>
      </div>

      {/* ══ Block C — 2-col grid (Social | Marketplace visibility) ══ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
          marginBottom: 14,
        }}
      >
        {/* Social networks card */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 10,
            }}
          >
            {t('profile.socialNetworks')}
          </div>
          <div className="form-group">
            <label className="form-label">{t('profile.linkedin')}</label>
            <input
              className="form-input"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="https://linkedin.com/in/..."
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('profile.instagram')}</label>
            <input
              className="form-input"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@handle"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('profile.website')}</label>
            <input
              className="form-input"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        {/* Marketplace visibility card */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 10,
            }}
          >
            {t('profile.marketplaceVisibility')}
          </div>

          <div
            className="toggle-wrap"
            style={{ ...innerRowStyle, marginBottom: 10 }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="toggle-lbl">{t('profile.showInSearch')}</div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text2)',
                  marginTop: 2,
                }}
              >
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

          <div
            className="toggle-wrap"
            style={{ ...innerRowStyle, marginBottom: 0 }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="toggle-lbl">{t('profile.acceptNewClients')}</div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text2)',
                  marginTop: 2,
                }}
              >
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
    </>
  );
}
