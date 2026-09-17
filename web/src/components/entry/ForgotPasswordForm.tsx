import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Placeholder for the full forgot-password form (#1058 later phase builds
 * the email field, submit mutation, and the neutral anti-enumeration
 * confirmation copy). This phase only needs the routing restructure and
 * the panel swap to be real, so this component is deliberately minimal: a
 * heading and a way back to "/".
 */
export default function ForgotPasswordForm() {
  const { t } = useTranslation();

  return (
    <>
      <h3 className="text-auth-title font-bold text-ink">
        {t('entry.forgotPassword.placeholderTitle')}
      </h3>
      <p className="text-meta text-muted-foreground">
        <Link to="/" className="font-medium text-brand hover:underline">
          {t('entry.forgotPassword.backToLogin')}
        </Link>
      </p>
    </>
  );
}
