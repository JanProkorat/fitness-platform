import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

/** Client-side search over the loaded conversation list, filtering by participant name. No server search. */
export default function InboxSearch({ value, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <div className="relative w-full">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('inbox.searchPlaceholder')}
        aria-label={t('inbox.searchPlaceholder')}
        className="h-8 pl-8"
      />
    </div>
  );
}
