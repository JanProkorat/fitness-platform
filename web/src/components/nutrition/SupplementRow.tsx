import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import type { SupplementDto } from '@/api/plan-types';

interface SupplementRowProps {
  supplement: SupplementDto;
  onEdit: () => void;
  onRemove: () => void;
}

export function SupplementRow({ supplement, onEdit, onRemove }: SupplementRowProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-start gap-2 px-3 py-2.5 border border-border rounded-md bg-bg hover:bg-bg2 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-text truncate">{supplement.name}</p>
        {supplement.dose && (
          <p className="text-[12px] text-text2 mt-0.5 truncate">{supplement.dose}</p>
        )}
        {supplement.notes && (
          <p className="text-[12px] text-text3 mt-0.5 line-clamp-2">{supplement.notes}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" onClick={onEdit} type="button">
          {t('nutrition.supplements.editButton')}
        </Button>
        <Button variant="ghost" size="sm" onClick={onRemove} type="button" className="text-red hover:text-red">
          {t('nutrition.supplements.removeButton')}
        </Button>
      </div>
    </div>
  );
}
