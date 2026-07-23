"use client";

import { ChevronDown, Clock } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TimePickerCalendar } from "@/components/time-picker-calendar";
import { PICKER_PANEL_SELECTOR } from "@/lib/date-picker";
import {
  formatTimeInputDisplay,
  resolveTimePickerView,
} from "@/lib/time-picker";
import { insetShellClass } from "@/components/ui-blocks";

const shellBaseClass =
  `${insetShellClass} box-border inline-flex min-w-0 items-center gap-2 rounded-lg border border-solid border-black bg-surface-inset`;

const triggerClass =
  "inset-field flex min-h-0 min-w-0 flex-1 items-center truncate border-0 bg-transparent p-0 text-left text-sm font-black leading-none text-[#f8fafc] outline-none";

type TimePickerInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  onFocus?: () => void;
  disabled?: boolean;
  className?: string;
  shellClassName?: string;
  ariaLabel: string;
  active?: boolean;
};

export function TimePickerInput({
  value,
  onChange,
  onBlur,
  onFocus,
  disabled = false,
  className = "",
  shellClassName = "",
  ariaLabel,
  active = false,
}: TimePickerInputProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [pickerSession, setPickerSession] = useState(0);
  const [view, setView] = useState(() => resolveTimePickerView(value));

  useEffect(() => {
    if (!value) return;

    let active = true;
    queueMicrotask(() => {
      if (active) setView(resolveTimePickerView(value));
    });
    return () => {
      active = false;
    };
  }, [value]);

  const shellClass = `${shellBaseClass} h-9 w-full px-2.5 ${active ? "ring-2 ring-emerald-500/70" : ""} ${shellClassName}`;

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();

    setPanelPosition({
      top: rect.bottom + 6,
      left: rect.left,
    });
  }, []);

  const openPicker = useCallback(() => {
    if (disabled) {
      return;
    }

    setView(resolveTimePickerView(value));
    setPickerSession((current) => current + 1);
    updatePanelPosition();
    onFocus?.();
    setOpen(true);
  }, [disabled, onFocus, updatePanelPosition, value]);

  const closePicker = useCallback(() => {
    setOpen(false);
    setPanelPosition(null);
    onBlur?.(value);
  }, [onBlur, value]);

  const pickTime = useCallback(
    (nextValue: string) => {
      onChange(nextValue);
      setView(resolveTimePickerView(nextValue));
    },
    [onChange],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const close = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (triggerRef.current?.contains(target)) {
        return;
      }

      if (
        target instanceof Element &&
        target.closest(PICKER_PANEL_SELECTOR)
      ) {
        return;
      }

      closePicker();
    };

    window.addEventListener("pointerdown", close);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [closePicker, open, updatePanelPosition]);

  return (
    <>
      <div className={`${shellClass} ${className}`}>
        <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          className={triggerClass}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => {
            if (open) {
              closePicker();
              return;
            }

            openPicker();
          }}
        >
          {formatTimeInputDisplay(value)}
        </button>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </div>

      {open && panelPosition ? (
        <div
          className="fixed z-[160]"
          style={{
            top: panelPosition.top,
            left: panelPosition.left,
          }}
        >
          <TimePickerCalendar
            key={pickerSession}
            view={view}
            onChange={pickTime}
            onComplete={closePicker}
          />
        </div>
      ) : null}
    </>
  );
}
