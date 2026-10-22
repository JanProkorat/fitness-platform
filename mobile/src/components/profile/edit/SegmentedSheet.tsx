import { Segmented } from '@/components/onboarding/Segmented';
import type { SegmentOption } from '@/components/onboarding/Segmented';
import { SheetCancel, SheetFrame } from '@/components/profile/edit/SheetFrame';

type SegmentedSheetProps<T extends string | number> = {
  visible: boolean;
  title: string;
  options: readonly SegmentOption<T>[];
  value: T | null;
  /** Called with the picked value; the sheet closes itself afterwards. */
  onSelect: (value: T) => void;
  onClose: () => void;
};

/** Bottom sheet with the onboarding segmented control, for answers with a few short options. */
export function SegmentedSheet<T extends string | number>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: SegmentedSheetProps<T>) {
  return (
    <SheetFrame visible={visible} title={title} onClose={onClose} action={<SheetCancel onPress={onClose} />}>
      <Segmented
        accessibilityLabel={title}
        options={options}
        value={value}
        onChange={(picked) => {
          onSelect(picked);
          onClose();
        }}
      />
    </SheetFrame>
  );
}
