import { cn } from '@/lib/cn';

export interface MessageBubbleProps {
  text: string;
  time: string;
  isOwn: boolean;
  initials?: string;
  avatarColor?: string;
  showAvatar?: boolean;
}

export function MessageBubble({
  text,
  time,
  isOwn,
  initials,
  avatarColor = 'var(--blue)',
  showAvatar = true,
}: MessageBubbleProps) {
  return (
    <div className={cn('flex items-end gap-[7px] mb-0.5', isOwn && 'flex-row-reverse')}>
      {/* Avatar for received messages */}
      {!isOwn && (
        <div
          className={cn(
            'w-[26px] h-[26px] rounded-lg shrink-0 flex items-center justify-center text-[10px] font-semibold text-white mb-[1px]',
            !showAvatar && 'invisible',
          )}
          style={{ backgroundColor: avatarColor }}
        >
          {initials}
        </div>
      )}

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[420px] px-3 py-2 text-[13px] leading-relaxed break-words',
          isOwn
            ? 'bg-accent text-white rounded-[14px] rounded-br-[4px]'
            : 'bg-bg2 text-text rounded-[14px] rounded-bl-[4px] border border-border',
        )}
      >
        {text}
        <span
          className={cn(
            'block text-[10px] mt-[3px]',
            isOwn ? 'text-right opacity-60' : 'text-left text-text3',
          )}
        >
          {time}
          {isOwn && ' \u2713\u2713'}
        </span>
      </div>
    </div>
  );
}
