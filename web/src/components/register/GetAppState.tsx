import { CheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import RegisterStepper from '@/components/register/RegisterStepper';
import StoreButtons from '@/components/register/StoreButtons';

interface GetAppStateProps {
  email: string;
  firstName: string;
}

/** Final register step for clients: the account is verified, the rest happens in the app. */
export default function GetAppState({ email, firstName }: GetAppStateProps) {
  const { t } = useTranslation();

  return (
    <main className="flex flex-1 flex-col items-center px-4 pt-8 pb-16 short:pt-2 short:pb-6 sm:px-10 sm:py-12 short:sm:py-4">
      <div className="my-auto flex w-full max-w-140 flex-col items-center gap-4.5 rounded-glass border border-border bg-surface px-5 pt-8 pb-9 text-center shadow-card short:gap-3 short:pt-5 short:pb-6 sm:px-10">
        <div className="self-stretch pb-2 text-left">
          <RegisterStepper current={3} finalStep="getApp" />
        </div>

        <span className="flex size-21 items-center justify-center rounded-full bg-success-soft text-success-ink short:size-14">
          <CheckIcon className="size-9.5 short:size-7" strokeWidth={2} aria-hidden="true" />
        </span>

        <h1 className="font-display text-display font-semibold tracking-heading text-ink short:text-card-title">
          {t('entry.verifyEmail.success.title')}
        </h1>
        <p className="text-subhead text-ink-2">
          {firstName
            ? t('entry.verifyEmail.getApp.welcomeNamed', { firstName })
            : t('entry.verifyEmail.getApp.welcome')}{' '}
          {t('entry.verifyEmail.getApp.ready')}
        </p>

        <StoreButtons variant="wide" className="self-stretch pt-1.5" />

        {email && (
          <p className="text-body text-muted-foreground">
            {t('entry.verifyEmail.getApp.signInWith')}{' '}
            <b className="font-bold break-all text-ink">{email}</b>
          </p>
        )}
      </div>
    </main>
  );
}
