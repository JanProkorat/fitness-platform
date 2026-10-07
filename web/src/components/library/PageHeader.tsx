interface Props {
  eyebrow: string;
  title: string;
}

/** Eyebrow (green dot + uppercase label) over the page title, shared by the Ingredients and Recipes pages. */
export default function PageHeader({ eyebrow, title }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.75 text-label font-semibold tracking-label text-nutrition uppercase">
        <span className="size-1.75 rounded-full bg-nutrition" aria-hidden="true" />
        {eyebrow}
      </span>
      <h1 className="text-display font-semibold text-ink">{title}</h1>
    </div>
  );
}
