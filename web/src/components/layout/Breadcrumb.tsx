import { cn } from '@/lib/cn';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav
      className="flex items-center gap-1 px-20 pt-2.5 text-[13px] text-text3"
      aria-label="Breadcrumb"
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;

        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-text4">/</span>}

            {isLast || !item.href ? (
              <span
                className={cn(
                  isLast ? 'text-text' : 'text-text3',
                )}
              >
                {item.label}
              </span>
            ) : (
              <a
                href={item.href}
                className="cursor-pointer text-text3 no-underline transition-colors duration-100 hover:text-text"
              >
                {item.label}
              </a>
            )}
          </span>
        );
      })}
    </nav>
  );
}
