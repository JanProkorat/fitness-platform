interface Props {
  title: string;
  body: string;
}

/**
 * Shared body for the v1 nav pages (Clients/Inbox/Ingredients/Recipes)
 * before their real implementation lands in a later epic sub-issue — see
 * docs/superpowers/specs/2026-09-14-web-v1-rebuild-design.md §5.
 */
export default function PagePlaceholder({ title, body }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-title font-bold text-ink">{title}</h1>
      <p className="text-body text-muted-foreground">{body}</p>
    </div>
  );
}
