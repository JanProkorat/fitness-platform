import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useFoodTags } from '@/hooks/useIngredientsQueries';

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  id?: string;
}

/**
 * Free-form tag chip editor for the ingredient drawer's "Tags & Classification"
 * section. Suggestions come from `GET /foods/tags` (every tag visible to the
 * caller) so a coach reuses an existing tag spelling instead of forking a
 * near-duplicate ("high-protein" vs "high protein").
 */
export default function TagsInput({ value, onChange, id }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const tagsQuery = useFoodTags();

  const suggestions = (tagsQuery.data ?? [])
    .filter((tag) => !value.includes(tag))
    .filter((tag) => draft.trim().length === 0 || tag.toLowerCase().includes(draft.trim().toLowerCase()))
    .slice(0, 8);

  function addTag(rawTag: string) {
    const tag = rawTag.trim();
    if (!tag || value.includes(tag)) {
      return;
    }
    onChange([...value, tag]);
    setDraft('');
  }

  function removeTag(tag: string) {
    onChange(value.filter((existing) => existing !== tag));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(draft);
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-caption font-medium text-muted-foreground"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={t('common.removeChip', { value: tag })}
              className="rounded-full hover:text-foreground"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <Input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(draft)}
          placeholder={value.length === 0 ? t('ingredients.drawer.tagsPlaceholder') : ''}
          className="h-6 flex-1 min-w-24 border-0 p-0 shadow-none focus-visible:ring-0"
        />
      </div>
      {suggestions.length > 0 && draft.trim().length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {suggestions.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => addTag(tag)}
                className="rounded-full border border-border px-2 py-0.5 text-caption text-muted-foreground hover:bg-muted"
              >
                {tag}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
