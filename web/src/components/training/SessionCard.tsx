export interface SessionCardProps {
  name: string;
  meta?: string;
  onClick?: () => void;
}

export function SessionCard({ name, meta, onClick }: SessionCardProps) {
  return (
    <div
      className="bg-bg2 border border-border rounded-sm px-[7px] py-[5px] mb-1 cursor-pointer transition-colors hover:border-border-md hover:bg-bg-hover"
      onClick={onClick}
    >
      <div className="text-[11px] font-semibold text-text">{name}</div>
      {meta && <div className="text-[10px] text-text3">{meta}</div>}
    </div>
  );
}
