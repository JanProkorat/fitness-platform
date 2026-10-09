import { useTranslation } from 'react-i18next';

/** "Typing…" hint shown under the thread while the other party is composing a message. */
export default function TypingIndicator() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1 pb-3 pl-15.5 pr-6 text-meta text-muted-foreground" role="status">
      {t('inbox.typingIndicator')}
    </div>
  );
}
