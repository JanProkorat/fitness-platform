import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import type { ClientDashboard } from '@/api/nutrition-goals';

interface IdentityStripProps {
  client: ClientDashboard;
  clientId: string;
  clientInitials: string;
  clientAge: number | null;
  onEditProfile: () => void;
}

export function IdentityStrip({
  client,
  clientId,
  clientInitials,
  clientAge,
  onEditProfile,
}: IdentityStripProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const ob = client.onboarding;
  const allergiesRaw = ob?.allergies ?? null;
  let allergiesDisplay: string | null = null;
  if (allergiesRaw) {
    try {
      const arr = JSON.parse(allergiesRaw) as unknown;
      if (Array.isArray(arr)) {
        allergiesDisplay = arr.join(', ');
      } else {
        allergiesDisplay = allergiesRaw;
      }
    } catch {
      allergiesDisplay = allergiesRaw;
    }
  }

  const clientName = `${client.firstName} ${client.lastName}`;
  const height = client.heightCm;

  return (
    <div className="flex items-center gap-3.5 px-20 py-5 pb-3.5">
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div
          className="w-12 h-12 rounded-full bg-bg3 flex items-center justify-center font-semibold text-[18px] text-text2"
          aria-label={clientInitials}
        >
          {clientInitials}
        </div>
      </div>

      {/* Name + meta line */}
      <div className="min-w-0 flex-1">
        <h1 className="text-[21px] font-bold tracking-[-0.02em] leading-[1.15] text-text">
          {clientName}
        </h1>
        <div className="flex items-center gap-2 mt-0.5 text-[13px] text-text3">
          {clientAge != null && (
            <span>
              {t('clientDetail.ageYears', { count: clientAge })}
            </span>
          )}
          {clientAge != null && height != null && (
            <span className="text-text4">·</span>
          )}
          {height != null && (
            <span>{height} cm</span>
          )}
          {allergiesDisplay && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-bg text-orange">
              ⚠ {allergiesDisplay}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="ml-auto flex items-center gap-1.5">
        <Button onClick={onEditProfile}>
          ✏ {t('clients.editProfile')}
        </Button>
        <Button
          variant="primary"
          onClick={() => navigate(`/messages?clientId=${clientId}`)}
        >
          ✉ {t('clientDetail.writeMessage')}
        </Button>
      </div>
    </div>
  );
}
