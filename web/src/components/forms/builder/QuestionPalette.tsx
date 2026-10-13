import { useTranslation } from 'react-i18next';
import { useDraggable } from '@dnd-kit/react';
import { GripVertical, Plus } from 'lucide-react';
import { QuestionnaireType } from '@/api/questionnaires';
import { PALETTE_DRAG, PALETTE_SENSORS } from '@/components/forms/builder/form-builder-drag';
import { kindHintKey, kindNameKey } from '@/components/forms/builder/form-builder-kinds';
import KindIcon from '@/components/forms/builder/KindIcon';
import { paletteKinds, QuestionKind, type PaletteKind } from '@/components/forms/builder/form-builder-model';
import { cn } from '@/lib/utils';

interface TileProps {
  kind: PaletteKind;
  onAdd: (kind: PaletteKind) => void;
}

const TILE_TONE: Partial<Record<PaletteKind, string>> = {
  [QuestionKind.SmileyRating]: 'bg-nutrition-soft text-nutrition-ink',
  [QuestionKind.StarRating]: 'bg-training-soft text-training-ink',
};

/** One question type: click appends it, dragging it into the form inserts it where it is dropped. */
function PaletteTile({ kind, onAdd }: TileProps) {
  const { t } = useTranslation();
  const { ref, isDragging } = useDraggable({
    id: `palette:${kind}`,
    type: PALETTE_DRAG,
    data: { kind: 'palette', paletteKind: kind },
    sensors: PALETTE_SENSORS,
  });

  return (
    <li>
      <button
        ref={ref}
        type="button"
        data-testid="palette-tile"
        data-kind={kind}
        aria-label={t('forms.builder.palette.add', { name: t(kindNameKey(kind)) })}
        onClick={() => onAdd(kind)}
        className={cn(
          'group flex w-full cursor-grab items-center gap-2.5 rounded-xl border border-line bg-card p-2.5 text-left shadow-panel outline-none transition-colors hover:border-ink focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing',
          isDragging && 'opacity-50',
        )}
      >
        <GripVertical className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span
          className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', TILE_TONE[kind] ?? 'text-ink')}
          aria-hidden="true"
        >
          <KindIcon kind={kind} className="size-4.5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-copy font-semibold text-ink">{t(kindNameKey(kind))}</span>
          <span className="truncate text-meta text-muted-foreground">{t(kindHintKey(kind))}</span>
        </span>
        <Plus
          className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden="true"
        />
      </button>
    </li>
  );
}

interface Props {
  formType: QuestionnaireType;
  onAdd: (kind: PaletteKind) => void;
}

/** Left panel: the standard question types, ordered as the board lists them for this form type. */
export default function QuestionPalette({ formType, onAdd }: Props) {
  const { t } = useTranslation();
  return (
    <aside
      aria-label={t('forms.builder.palette.title')}
      className="flex h-full w-64 shrink-0 lg:w-72 xl:w-80 flex-col gap-3 overflow-y-auto border-r-2 border-line bg-sunken px-4 py-4"
    >
      <div className="flex flex-col gap-1.5">
        <h2 className="flex items-center gap-2 text-label font-bold tracking-label text-ink uppercase">
          <Plus className="size-3.5" aria-hidden="true" />
          {t('forms.builder.palette.title')}
        </h2>
        <p className="text-body text-muted-foreground">{t('forms.builder.palette.hint')}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {paletteKinds(formType).map((kind) => (
          <PaletteTile key={kind} kind={kind} onAdd={onAdd} />
        ))}
      </ul>
    </aside>
  );
}
