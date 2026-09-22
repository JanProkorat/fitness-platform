import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUp, Image, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  onSend: (text: string) => void;
  isSending: boolean;
  onTyping?: () => void;
}

/**
 * Message composer, pinned to the bottom of the thread pane. Enter sends;
 * Shift+Enter inserts a newline. The paperclip (file attachments) is
 * disabled for v1; the image button is disabled until #1096 (chat image
 * attachments) lands.
 */
export default function Composer({ onSend, isSending, onTyping }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || isSending) {
      return;
    }
    onSend(trimmed);
    setValue('');
  }

  return (
    <div className="flex items-end gap-2 border-t border-border p-4">
      <div className="flex flex-1 items-end gap-1 rounded-3xl border border-input bg-background px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled
          title={t('shell.comingSoon')}
          aria-label={t('inbox.composer.attachFileAriaLabel')}
        >
          <Paperclip className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled
          title={t('shell.comingSoon')}
          aria-label={t('inbox.composer.attachImageAriaLabel')}
        >
          <Image className="size-4" aria-hidden="true" />
        </Button>
        <Textarea
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            onTyping?.();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={t('inbox.composer.placeholder')}
          rows={1}
          className="min-h-8 flex-1 resize-none border-none bg-transparent px-1 py-1 shadow-none focus-visible:ring-0"
        />
      </div>
      <Button
        type="button"
        size="icon"
        className="shrink-0 rounded-full"
        disabled={!value.trim() || isSending}
        onClick={submit}
        aria-label={t('inbox.composer.sendAriaLabel')}
      >
        <ArrowUp className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
