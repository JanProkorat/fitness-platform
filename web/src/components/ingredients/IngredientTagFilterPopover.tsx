import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useFoodTags } from '@/hooks/useIngredientsQueries';

interface Props {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Tags multi-select for filtering the ingredients table. Mirrors
 * `ClientTagFilterPopover` (`@/components/clients/ClientTagFilterPopover.tsx`)
 * — built on Popover rather than DropdownMenu so multi-select doesn't fight
 * Radix's close-on-select default. Backed by the distinct tag values from
 * `GET /foods/tags`, not a per-owner tag entity like the clients tags.
 */
export default function IngredientTagFilterPopover({ selectedTags, onChange }: Props) {
  const { t } = useTranslation();
  const tagsQuery = useFoodTags();
  const tags = tagsQuery.data ?? [];

  function toggleTag(tag: string) {
    onChange(selectedTags.includes(tag) ? selectedTags.filter((t2) => t2 !== tag) : [...selectedTags, tag]);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-full">
          <Plus className="size-3" aria-hidden="true" />
          {t('ingredients.filters.tags')}
          {selectedTags.length > 0 && <span className="text-caption">{selectedTags.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        {tagsQuery.isPending ? (
          <p className="text-body text-muted-foreground">{t('common.loading')}</p>
        ) : tags.length === 0 ? (
          <p className="text-body text-muted-foreground">{t('ingredients.filters.tagsEmpty')}</p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-2.5 overflow-y-auto">
            {tags.map((tag) => (
              <li key={tag}>
                <label className="flex cursor-pointer items-center gap-2 text-body text-foreground">
                  <Checkbox checked={selectedTags.includes(tag)} onCheckedChange={() => toggleTag(tag)} />
                  {tag}
                </label>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
