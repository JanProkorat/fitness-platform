interface Props {
  protein: number;
  carbs: number;
  fat: number;
}

/** Thin stacked bar showing the protein / carbs / fat split of a card. */
export default function MacroBar({ protein, carbs, fat }: Props) {
  const total = protein + carbs + fat;
  const segments = [
    { className: 'bg-macro-protein', value: protein },
    { className: 'bg-macro-carbs', value: carbs },
    { className: 'bg-macro-fat', value: fat },
  ];
  return (
    <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      {total > 0 &&
        segments.map(
          (segment) =>
            segment.value > 0 && (
              // The width is the runtime macro share, not a design value.
              <div
                key={segment.className}
                className={segment.className}
                style={{ width: `${(segment.value / total) * 100}%` }}
              />
            ),
        )}
    </div>
  );
}
