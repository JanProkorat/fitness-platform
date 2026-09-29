import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useFoodTags } from '@/hooks/useIngredientsQueries';
import { MAX_TAGS, MAX_TAG_LENGTH } from '@/components/ingredients/tagLimits';

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
 *
 * Tags are lowercased and trimmed as they're added — the backend normalises
 * tags to lowercase on save, so doing the same here means what the coach
 * sees in the chip matches what's actually persisted, and two tags that
 * differ only by case never both slip in as "duplicates" client-side either.
 *
 * A comma is never allowed inside a tag's stored content: `useIngredientListParams`
 * joins/splits the URL's `tags` filter on commas, so an embedded comma would
 * make that round-trip ambiguous, and the backend rejects one too. Typing a
 * comma is intercepted per-keystroke below, but a paste can still land one in
 * `draft` directly — `commitTags` treats any comma in the committed text as a
 * separator between multiple tags rather than part of one, covering both paths.
 */
export default function TagsInput({ value, onChange, id }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [tooLong, setTooLong] = useState(false);
  const tagsQuery = useFoodTags();

  const suggestions = (tagsQuery.data ?? [])
    .filter((tag) => !value.includes(tag))
    .filter((tag) => draft.trim().length === 0 || tag.toLowerCase().includes(draft.trim().toLowerCase()))
    .slice(0, 8);

  const atMax = value.length >= MAX_TAGS;

  /** Commits one or more tags from a raw input string, splitting on comma so
   * a pasted "a, b, c" (or a single plain tag) both work through one path. */
  function commitTags(rawInput: string) {
    const candidates = rawInput
      .split(',')
      .map((candidate) => candidate.trim().toLowerCase())
      .filter(Boolean);
    if (candidates.length === 0) {
      return;
    }

    let next = value;
    let sawTooLong = false;
    for (const candidate of candidates) {
      if (candidate.length > MAX_TAG_LENGTH) {
        sawTooLong = true;
        continue;
      }
      if (next.some((existing) => existing.toLowerCase() === candidate)) {
        continue;
      }
      if (next.length >= MAX_TAGS) {
        break;
      }
      next = [...next, candidate];
    }

    setTooLong(sawTooLong);
    setDraft('');
    if (next !== value) {
      onChange(next);
    }
  }

  function removeTag(tag: string) {
    onChange(value.filter((existing) => existing !== tag));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitTags(draft);
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
        {/* Stays mounted (disabled at the cap) rather than unmounting, so
         * `<Label htmlFor={id}>` in IngredientDrawer keeps resolving to a
         * real, focusable element instead of pointing at nothing (#1115
         * code review). */}
        <Input
          id={id}
          value={draft}
          disabled={atMax}
          onChange={(event) => {
            setDraft(event.target.value);
            setTooLong(false);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => commitTags(draft)}
          placeholder={value.length === 0 ? t('ingredients.drawer.tagsPlaceholder') : ''}
          className="h-6 flex-1 min-w-24 border-0 p-0 shadow-none focus-visible:ring-0"
        />
      </div>
      {tooLong && <p className="text-meta text-destructive">{t('ingredients.drawer.tagTooLong', { max: MAX_TAG_LENGTH })}</p>}
      {/* Exactly-at-cap only: a legacy food loaded already over the cap
       * (length > MAX_TAGS) is instead reported once by IngredientDrawer's
       * own zod-driven `errors.tags` message — rendering both here would
       * show the identical text twice (#1115 code review). */}
      {value.length === MAX_TAGS && (
        <p className="text-meta text-muted-foreground">{t('ingredients.drawer.tagsMax', { max: MAX_TAGS })}</p>
      )}
      {suggestions.length > 0 && draft.trim().length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {suggestions.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => commitTags(tag)}
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
