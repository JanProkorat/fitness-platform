interface MentionProps {
  children: React.ReactNode;
  onClick?: () => void;
}

export function Mention({ children, onClick }: MentionProps) {
  return (
    <span
      className="inline-flex items-center gap-[3px] bg-bg2 border border-border rounded-sm px-1.5 py-[1px] text-xs text-text2 cursor-pointer transition-colors hover:bg-bg3"
      onClick={onClick}
    >
      {children}
    </span>
  );
}
