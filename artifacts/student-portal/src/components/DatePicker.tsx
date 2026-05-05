import { useEffect, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { es } from 'react-day-picker/locale';
import { format } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import './DatePicker.css';

export interface DatePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'dd/mm/aaaa',
  disabled = false,
  required,
  id,
  minDate = new Date(1900, 0, 1),
  maxDate = new Date(),
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const displayValue = value ? format(value, 'dd/MM/yyyy') : '';

  function handleSelect(date: Date | undefined) {
    onChange(date);
    setOpen(false);
  }

  const defaultMonth = value ?? new Date();

  return (
    <div ref={wrapRef} className={`dp-input-wrap${className ? ` ${className}` : ''}`}>
      {/* Trigger input */}
      <input
        id={id}
        type="text"
        readOnly
        required={required}
        value={displayValue}
        placeholder={placeholder}
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen((o) => !o); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!disabled) setOpen((o) => !o);
          }
        }}
        className={[
          'dp-input',
          open ? 'open' : '',
          disabled ? 'disabled' : '',
          !displayValue ? 'placeholder' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-haspopup="dialog"
        aria-expanded={open}
        autoComplete="off"
      />
      <CalendarDays size={16} className="dp-icon" />

      {/* Popover */}
      {open && (
        <div className="dp-popover" role="dialog" aria-label="Selecciona una fecha">
          <DayPicker
            mode="single"
            selected={value}
            onSelect={handleSelect}
            locale={es}
            captionLayout="dropdown"
            defaultMonth={defaultMonth}
            startMonth={minDate}
            endMonth={maxDate}
            disabled={[{ after: maxDate }, { before: minDate }]}
          />
        </div>
      )}
    </div>
  );
}
