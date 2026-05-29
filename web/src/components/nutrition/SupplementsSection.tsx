import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SupplementRow } from '@/components/nutrition/SupplementRow';
import { SupplementEditorDialog } from '@/components/nutrition/SupplementEditorDialog';
import type { SupplementDto } from '@/api/plan-types';

interface SupplementsSectionProps {
  supplements: SupplementDto[];
  onChange: (supplements: SupplementDto[]) => void;
}

export function SupplementsSection({ supplements, onChange }: SupplementsSectionProps) {
  const { t } = useTranslation();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAdd = () => {
    setEditingIndex(null);
    setEditorOpen(true);
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditorOpen(true);
  };

  const handleRemove = (index: number) => {
    onChange(supplements.filter((_, i) => i !== index));
  };

  const handleSave = (values: { name: string; dose: string | null; notes: string | null }) => {
    if (editingIndex === null) {
      // Add new supplement — generate a client-side UUID as externalId so mobile reminder
      // keys survive the round-trip; backend accepts any UUID, generates one if absent.
      const newSupplement: SupplementDto = {
        externalId: crypto.randomUUID(),
        name: values.name,
        dose: values.dose,
        notes: values.notes,
      };
      onChange([...supplements, newSupplement]);
    } else {
      // Update existing supplement, preserve externalId
      const updated = supplements.map((s, i) =>
        i === editingIndex
          ? { ...s, name: values.name, dose: values.dose, notes: values.notes }
          : s,
      );
      onChange(updated);
    }
    setEditorOpen(false);
    setEditingIndex(null);
  };

  const editingSupplement = editingIndex !== null ? (supplements[editingIndex] ?? null) : null;

  return (
    <div className="flex flex-col gap-2">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-text">
          {t('nutrition.supplements.sectionTitle')}
        </h3>
        <Button variant="default" size="sm" type="button" onClick={handleAdd}>
          {t('nutrition.supplements.addButton')}
        </Button>
      </div>

      {/* List */}
      {supplements.length === 0 ? (
        <p className="text-[12px] text-text3 py-2">{t('nutrition.supplements.emptyState')}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {supplements.map((supplement, index) => (
            <SupplementRow
              key={supplement.externalId}
              supplement={supplement}
              onEdit={() => handleEdit(index)}
              onRemove={() => handleRemove(index)}
            />
          ))}
        </div>
      )}

      {/* Editor dialog */}
      <SupplementEditorDialog
        open={editorOpen}
        supplement={editingSupplement}
        onSave={handleSave}
        onClose={() => {
          setEditorOpen(false);
          setEditingIndex(null);
        }}
      />
    </div>
  );
}
