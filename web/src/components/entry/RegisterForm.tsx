import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Placeholder for the full registration form (#1058 phase 2 builds the
 * role picker, password-strength rules, and field set). This phase only
 * needs the routing restructure and the panel swap to be real, so this
 * component is deliberately minimal: a heading and a way back to "/".
 */
export default function RegisterForm() {
  const { t } = useTranslation();

  return (
    <>
      <h3 className="text-auth-title font-bold text-ink">{t('entry.register.placeholderTitle')}</h3>
      <p className="text-meta text-muted-foreground">
        <Link to="/" className="font-medium text-brand hover:underline">
          {t('entry.register.backToLogin')}
        </Link>
      </p>
    </>
  );
}
