---
name: web-page
description: Scaffold a new route page in `/web/src/pages/` following the portal's idiom — TanStack Query for load, React Hook Form + Zod for forms, headless Tailwind primitives from `@/components/ui`, i18n keys in cs/en/de, no hardcoded colors/spacing, no `any`. Invoke when a task asks for a "new page", "new route", or "new screen" in the trainer web portal.
---

# web-page — scaffold a trainer-portal page

Use when adding a route page to `/web`. This skill codifies the idioms used
across `src/pages/*.tsx` so new pages fit the existing conventions without
drift.

## Decide first

1. **Page name** — PascalCase + `Page` suffix (`ClientDetailPage`,
   `MealPlanEditorPage`). Matches the `src/pages/` neighbours.
2. **Route path** — register in the router alongside siblings. Look at
   `main.tsx` / the router file for the current pattern.
3. **Shape of the page** — is it a list, a detail view, an editor, a form,
   or a composition of these? Different idioms below.
4. **Server state** — which queries and mutations are needed? Plan the
   TanStack Query keys up front (`['clients', clientId, 'plans']` etc.).
5. **i18n namespace** — translations live in `src/i18n/locales/{cs,en,de}.json`.
   Decide the key prefix (e.g. `"mealPlanEditor.*"`) before writing copy.

## File to create

`web/src/pages/<Name>Page.tsx`. Skeleton for a typical detail-with-mutation
page:

```tsx
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { clientsApi } from '@/api/clients';

const formSchema = z.object({
  name: z.string().min(1),
  goalKcal: z.number().int().positive(),
});
type FormValues = z.infer<typeof formSchema>;

export default function ClientDetailPage() {
  const { t } = useTranslation();
  const { clientId = '' } = useParams();
  const queryClient = useQueryClient();

  const clientQuery = useQuery({
    queryKey: ['clients', clientId],
    queryFn: () => clientsApi.getById(clientId),
    enabled: Boolean(clientId),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', goalKcal: 2000 },
    values: clientQuery.data
      ? { name: clientQuery.data.name, goalKcal: clientQuery.data.goalKcal }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) => clientsApi.update(clientId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', clientId] });
    },
  });

  if (clientQuery.isPending) {
    return <div className="p-6 text-text-muted">{t('common.loading')}</div>;
  }

  if (clientQuery.isError) {
    return <div className="p-6 text-danger">{t('common.error')}</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold text-text">
        {t('clientDetail.title', { name: clientQuery.data.name })}
      </h1>

      <Card>
        <form
          onSubmit={form.handleSubmit((values) => updateMutation.mutate(values))}
          className="flex flex-col gap-4 p-6"
        >
          <Input label={t('clientDetail.name')} {...form.register('name')} />
          <Input
            label={t('clientDetail.goalKcal')}
            type="number"
            {...form.register('goalKcal', { valueAsNumber: true })}
          />
          <Button type="submit" disabled={updateMutation.isPending}>
            {t('common.save')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
```

Adjust for the actual shape:
- **List page** — `useQuery` returning a list; render via `DatabaseTable` /
  `CardGrid` from `components/data/`. Pagination via `page`/`pageSize` params
  matching the backend.
- **Editor with DnD** — use `@dnd-kit/react` patterns from existing plan
  builders in `components/training/`.
- **Read-only detail** — drop the form/mutation; keep the query.

## Non-negotiables

1. **No `any`.** Use the types exported from `@/api/generated` or your
   domain module. If a shape is missing, add a typed wrapper in
   `@/api/<module>.ts` — do NOT edit `generated.ts` (the hook will reject it).
2. **Tokens only.** Colors, spacing, radii come from Tailwind theme classes
   (`text-text`, `bg-surface`, `gap-6`, `rounded-md`). No hex, no inline
   style objects with hard-coded values. If a token is missing, add it to
   the theme rather than inlining.
3. **Design primitives come from `@/components/ui`.** Prefer `Button`,
   `Input`, `Dialog`, `Card`, etc. over raw elements. Match existing usage.
4. **i18n everywhere.** Every user-visible string goes through
   `useTranslation()`. Add keys to **all three** locales (`cs`, `en`, `de`).
   If you don't know the translation, copy the English key verbatim and flag
   the missing translations in the PR description.
5. **Path alias.** Use `@/…`, never relative traversal past one folder.
6. **TanStack Query over fetch-in-useEffect.** Always `useQuery` for loads,
   `useMutation` for writes, and `invalidateQueries` after mutations.
7. **Forms = RHF + Zod.** Schema next to the component (small forms) or in
   `@/lib/schemas` (shared). Bind via `zodResolver`.

## Verify

1. `npx tsc --noEmit` passes.
2. `npm run dev` — navigate to the route, exercise load, form submit,
   validation errors.
3. Switch language in the UI and confirm all copy renders in each locale.
4. Open devtools network tab — no polling (only initial load + post-mutation
   invalidation fetches).

## Related skills to chain

- **`design:design-critique`** — after the page renders, run a pass on
  hierarchy, spacing, and flow before handing back.
- **`design:accessibility-review`** — required for any page with forms,
  tables, or modals. Catches missing labels, contrast issues, keyboard
  traps.
- **`design:ux-copy`** — for CTA labels, empty states, error messages, and
  confirmation dialogs. Apply in all three locales (cs/en/de).
- **`design:design-system`** — if tempted to add a new primitive or a
  one-off `text-[14px]` / `bg-[#…]`, run this first to decide whether a
  token or component should be extended instead.
- **`design:design-handoff`** — when translating a prototype scene from
  `docs/notion_portal.html` into a real page, the handoff skill captures
  the token/spacing/state matrix so the page stays faithful.

## Checklist

- [ ] File at `src/pages/<Name>Page.tsx`, default export
- [ ] Route registered in the router
- [ ] All data via `useQuery`/`useMutation` with stable, specific keys
- [ ] Form (if any) uses RHF + Zod + `zodResolver`
- [ ] All copy via `t(...)`, with keys present in cs/en/de
- [ ] No hex colors, no inline hard-coded spacing — tokens only
- [ ] No `any`, no `@ts-ignore` without a justifying comment
- [ ] `generated.ts` NOT modified (hook enforces this)
- [ ] `npx tsc --noEmit` clean
