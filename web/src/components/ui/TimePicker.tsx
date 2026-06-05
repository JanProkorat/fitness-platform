/**
 * TimePicker — thin wrapper around <input type="time"> following the
 * auth-input / form-input styling convention used in PlanDialogs.tsx.
 *
 * Renders a native browser time picker that accepts any HH:mm value
 * (minute-level precision). The caller is responsible for converting
 * the "HH:mm" value to the "HH:mm:ss" wire format via toTimeSpanString().
 */
import { forwardRef } from 'react';

export interface TimePickerProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Current value in "HH:mm" format */
  value?: string;
  /** Called with the new "HH:mm" value when the user changes the time */
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

export const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(
  function TimePicker({ className, style, ...rest }, ref) {
    return (
      <input
        ref={ref}
        type="time"
        className={className ?? 'auth-input'}
        style={{
          fontSize: 13,
          padding: '7px 10px',
          cursor: 'pointer',
          width: '100%',
          ...style,
        }}
        {...rest}
      />
    );
  },
);
