import { cn } from '@/lib/cn';

interface CardGridProps {
  children: React.ReactNode;
  className?: string;
}

export function CardGrid({ children, className }: CardGridProps) {
  return (
    <div className={cn('grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5', className)}>
      {children}
    </div>
  );
}

interface CardProps {
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Card({ onClick, children, className }: CardProps) {
  return (
    <div
      className={cn(
        'border border-border rounded-md bg-bg cursor-pointer overflow-hidden transition-[box-shadow,border-color] duration-150 hover:border-border-md hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface CardCoverProps {
  color?: string;
  children?: React.ReactNode;
}

export function CardCover({ color, children }: CardCoverProps) {
  return (
    <div
      className="h-[72px] bg-bg3 relative overflow-hidden"
      style={color ? { backgroundColor: color } : undefined}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(55,53,47,0.04) 8px, rgba(55,53,47,0.04) 9px)',
        }}
      />
      {children}
    </div>
  );
}

interface CardBodyProps {
  children: React.ReactNode;
}

export function CardBody({ children }: CardBodyProps) {
  return <div className="px-3 py-2.5">{children}</div>;
}

interface CardPropRowProps {
  label: string;
  children: React.ReactNode;
}

export function CardPropRow({ label, children }: CardPropRowProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-text3 mb-[2px]">
      <span>{label}</span>
      <span className="text-text2">{children}</span>
    </div>
  );
}
