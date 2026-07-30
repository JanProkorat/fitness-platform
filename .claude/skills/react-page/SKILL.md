---
name: react-page
description: Scaffold a new route/page — data-fetching, form, and i18n wiring consistent with the rest of the app. No `any`, no hardcoded colors/spacing, generic entities. Invoke for "new page", "new route", "new screen" in a React/TS web app.
argument-hint: "<PageName> <route-path>"
---

# react-page — scaffold a route/page

Use when adding a route/page to a React/TS web app. This skill codifies the
idioms most React apps converge on (TanStack Query or equivalent for server
state, a schema-validated form library, a design-token system, an i18n
mechanism) without assuming any one project's exact folder names — read the
repo's own `CLAUDE.md` first for the concrete layout.

## Read-ONE-exemplar

When choosing an exemplar to model from, read **exactly ONE existing page**
with a similar shape (list / detail / editor / form). Most apps' page idiom
is consistent enough that one is sufficient. Fall back to a second exemplar
ONLY if the first is incomplete (e.g. doesn't cover the form-validation
pattern you need). **Never read more than two.** If you genuinely need
broader research (which state library, which query-cache key convention),
dispatch an Explore sub-agent with `model: "haiku"` instead of reading many
files inline — inline reads pollute your context.

## Decide first

1. **Page name** — match the casing/suffix convention of the neighbouring
   pages in the repo's route directory (commonly PascalCase + a `Page`
   suffix, e.g. `OrderDetailPage`, `ItemEditorPage` — but confirm against
   what's already there).
2. **Route path** — register in the router alongside its siblings. Check
   the router configuration file (e.g. `main.tsx`, `App.tsx`, a routes
   module, or a file-based-router convention) for the current pattern.
3. **Shape of the page** — list, detail view, editor, form, or a
   composition of these. Different idioms below.
4. **Server state** — which queries and mutations are needed? Plan the
   query keys up front (e.g. `['orders', orderId, 'items']`) before writing
   the component.
5. **i18n namespace** — decide the key prefix for new copy (e.g.
   `"orderDetail.*"`) before writing copy. See `rules/i18n.md` — the repo's
   own config, not this skill, defines which locales exist.

## File to create

Place the file wherever the repo's route pages already live (read
`CLAUDE.md` — commonly `src/pages/`, `src/routes/`, or `app/` for a
file-based router). Skeleton for a typical detail-with-mutation page, using
generic `Order`/`Item` entities — substitute your repo's real domain types
and its actual data-fetching/form/i18n imports:

```tsx
import { useTranslation } from 'react-i18next'; // or your repo's i18n hook
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useParams } from 'react-router-dom'; // or your router's param hook
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ordersApi } from '@/api/orders';

const formSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
});
type FormValues = z.infer<typeof formSchema>;

export default function OrderDetailPage() {
  const { t } = useTranslation();
  const { orderId = '' } = useParams();
  const queryClient = useQueryClient();

  const orderQuery = useQuery({
    queryKey: ['orders', orderId],
    queryFn: () => ordersApi.getById(orderId),
    enabled: Boolean(orderId),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', quantity: 1 },
    values: orderQuery.data
      ? { name: orderQuery.data.name, quantity: orderQuery.data.quantity }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) => ordersApi.update(orderId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', orderId] });
    },
  });

  if (orderQuery.isPending) {
    return <div className="p-6 text-text-muted">{t('common.loading')}</div>;
  }

  if (orderQuery.isError) {
    return <div className="p-6 text-danger">{t('common.error')}</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold text-text">
        {t('orderDetail.title', { name: orderQuery.data.name })}
      </h1>

      <Card>
        <form
          onSubmit={form.handleSubmit((values) => updateMutation.mutate(values))}
          className="flex flex-col gap-4 p-6"
        >
          <Input label={t('orderDetail.name')} {...form.register('name')} />
          <Input
            label={t('orderDetail.quantity')}
            type="number"
            {...form.register('quantity', { valueAsNumber: true })}
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
- **List page** — `useQuery` returning a collection; render via whatever
  table/grid primitive the repo already has. Pagination via whatever
  params the backend expects (`page`/`pageSize`, cursor, etc. — match the
  existing API modules).
- **Editor with drag-and-drop** — reuse the repo's existing DnD library
  pattern (e.g. `@dnd-kit`) rather than introducing a second one.
- **Read-only detail** — drop the form/mutation; keep the query.

## Non-negotiables

1. **No `any`.** Use the types exported from the generated API client (see
   `regen-api`) or your own domain module. If a shape is missing, add a
   typed wrapper in your `src/api/<module>.ts` — do NOT hand-edit the
   generated client (a hook rejects that edit; see `block-generated-client.py`
   / the `regen-api` skill).
2. **Design tokens only.** Colors, spacing, radii come from the repo's
   design-token system (a Tailwind theme, CSS variables, a styled-components
   theme object — whatever the repo uses). No hex literals, no inline style
   objects with hard-coded values. If a token is missing, add it to the
   theme rather than inlining — see `rules/code-style.md#design-tokens-over-hardcoded-values`.
3. **Design primitives come from the repo's own UI primitives folder**
   (commonly `@/components/ui`). Prefer the existing `Button`, `Input`,
   `Dialog`, `Card`, etc. over raw elements. Match existing usage.
4. **i18n everywhere.** Every user-visible string goes through the repo's
   i18n mechanism (e.g. `useTranslation()`). Add keys to **every locale the
   repo supports** — see `rules/i18n.md#i18n-is-a-mechanism-not-a-fixed-list`.
   If you don't know a translation, copy the source-locale key verbatim and
   flag the missing translation in the PR description.
5. **Path alias.** Use whatever import alias the repo has configured (often
   `@/…`), never relative traversal past one folder.
6. **Query-cache data fetching over fetch-in-`useEffect`.** See
   `rules/data-fetching.md` — `useQuery` for loads, `useMutation` for
   writes, `invalidateQueries` after mutations.
7. **Forms = schema-validated.** Pair the form library the repo already
   uses (commonly React Hook Form) with a schema validator (commonly Zod).
   Put the schema next to the component (small forms) or in a shared
   schemas module.

## Verify

1. `npx tsc --noEmit` passes (or the repo's own typecheck command — see
   `react-build`).
2. Run the dev server, navigate to the route, exercise the load, form
   submit, and validation-error paths.
3. Switch locale in the UI (if the repo's i18n mechanism supports runtime
   switching) and confirm all new copy renders in every supported locale.
4. Open devtools network tab — no polling (only initial load + post-mutation
   invalidation fetches), unless the page intentionally polls and that's
   documented.

## Accessibility pass (optional MCP)

If the repo has the `a11y-accessibility` MCP server available (see
`pack.json.mcp`), run it against the rendered page — `test_accessibility` /
`check_aria_attributes` / `check_color_contrast` — before reporting done.
Required whenever the scaffold introduces a form, table, or modal; optional
for a pure read-only page. If the MCP isn't wired up, note that the pass was
skipped rather than silently omitting it.

## Checklist

- [ ] File placed alongside the repo's existing route pages, default export
- [ ] Route registered in the router
- [ ] All data via `useQuery`/`useMutation` with stable, specific keys
- [ ] Form (if any) uses the repo's form library + schema validator
- [ ] All copy goes through the i18n mechanism, with keys present in every
      supported locale
- [ ] No hex colors, no inline hard-coded spacing — tokens only
- [ ] No `any`, no `@ts-ignore`/`@ts-expect-error` without a justifying comment
- [ ] Generated API client NOT hand-edited (hook enforces this)
- [ ] `npx tsc --noEmit` (or repo's typecheck command) clean
