import { useTranslation } from 'react-i18next';

interface Props {
  iso: string;
}

/** Centred, muted date/time separator between message clusters on different calendar days. */
export default function DateSeparator({ iso }: Props) {
  const { i18n } = useTranslation();

  const label = new Date(iso).toLocaleString(i18n.language, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="flex justify-center py-2">
      <span className="text-caption text-muted-foreground">{label}</span>
    </div>
  );
}
