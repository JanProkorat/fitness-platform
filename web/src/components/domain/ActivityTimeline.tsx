export interface TimelineItem {
  id: string;
  date: string;
  title: string;
  description?: string;
  icon?: string;
}

export interface ActivityTimelineProps {
  items: TimelineItem[];
}

export function ActivityTimeline({ items }: ActivityTimelineProps) {
  return (
    <div>
      {items.map((item, idx) => (
        <div key={item.id} className="flex gap-3 relative">
          {/* Left: dot + line */}
          <div className="flex flex-col items-center shrink-0">
            <div className="w-2 h-2 rounded-full bg-bg3 border-2 border-border-md mt-1.5 relative z-10" />
            {idx < items.length - 1 && (
              <div className="w-px flex-1 bg-border" />
            )}
          </div>

          {/* Right: content */}
          <div className="pb-4 min-w-0">
            <div className="text-xs text-text3">{item.date}</div>
            <div className="text-[13px] font-medium">
              {item.icon && <span className="mr-1">{item.icon}</span>}
              {item.title}
            </div>
            {item.description && (
              <div className="text-[13px] text-text2">{item.description}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
