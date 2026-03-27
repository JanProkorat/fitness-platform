export function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

export function FormRow3({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-3">{children}</div>;
}

export function FormDivider() {
  return <div className="h-px bg-border my-4" />;
}

export function FormSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-text uppercase tracking-[0.03em] mb-2.5">
      {children}
    </h3>
  );
}
