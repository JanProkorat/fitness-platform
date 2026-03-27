import { cn } from '@/lib/cn';

export interface MessageBubbleProps {
  name: string;
  avatarColor?: string;
  initials: string;
  time: string;
  text: string;
  isOwn?: boolean;
}

export function MessageBubble({
  name,
  avatarColor = 'bg-blue-bg text-blue',
  initials,
  time,
  text,
}: MessageBubbleProps) {
  return (
    <div className="flex items-start gap-2.5 px-2.5 py-[7px] rounded-md transition-colors hover:bg-bg-hover">
      {/* Avatar */}
      <div
        className={cn(
          'w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-semibold mt-[1px]',
          avatarColor,
        )}
      >
        {initials}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-[2px]">
          <span className="text-[13px] font-semibold">{name}</span>
          <span className="text-[11px] text-text3">{time}</span>
        </div>
        <div className="text-[13px] text-text leading-relaxed">{text}</div>
      </div>
    </div>
  );
}
