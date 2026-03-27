import { cn } from '@/lib/cn';

interface TagProps {
  variant: 'green' | 'red' | 'orange' | 'blue' | 'purple' | 'gray' | 'accent';
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<TagProps['variant'], string> = {
  green: 'bg-green-bg text-green',
  red: 'bg-red-bg text-red',
  orange: 'bg-orange-bg text-orange',
  blue: 'bg-blue-bg text-blue',
  purple: 'bg-purple-bg text-purple',
  gray: 'bg-bg3 text-text2',
  accent: 'bg-accent-bg text-accent',
};

export function Tag({ variant, children, className }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-[2px] rounded-full text-xs font-medium whitespace-nowrap',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
