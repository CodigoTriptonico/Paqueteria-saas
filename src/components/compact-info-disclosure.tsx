"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  resolveFloatingPanelPosition,
  type FloatingPanelAlign,
} from "@/lib/floating-panel-position";

type FloatingPosition = ReturnType<typeof resolveFloatingPanelPosition>;

export function CompactInfoDisclosure({
  ariaLabel,
  children,
  align = "left",
  title,
}: {
  ariaLabel: string;
  children: React.ReactNode;
  align?: FloatingPanelAlign;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const mounted = useHydrated();
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const triggerRect = trigger.getBoundingClientRect();
    setPosition(
      resolveFloatingPanelPosition({
        trigger: triggerRect,
        panelWidth: 320,
        panelHeight: panel.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        align,
      }),
    );
  }, [align]);

  useLayoutEffect(() => {
    if (open && mounted) updatePosition();
  }, [mounted, open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  const panel =
    open && mounted
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={title ?? ariaLabel}
            className="fixed z-[280] overflow-y-auto overflow-x-hidden rounded-lg border border-black bg-surface-panel px-3 py-2.5 text-sm font-bold leading-snug text-slate-200 shadow-[0_18px_48px_rgba(0,0,0,0.5)] [overflow-wrap:anywhere]"
            style={{
              top: position?.top ?? 12,
              left: position?.left ?? 12,
              width: position?.width ?? "min(20rem, calc(100vw - 1.5rem))",
              maxHeight: position?.maxHeight ?? "calc(100vh - 1.5rem)",
              visibility: position ? "visible" : "hidden",
            }}
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                {title ? <p className="mb-1 font-black text-[#f8fafc]">{title}</p> : null}
                <div>{children}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-surface-inset hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
                aria-label="Cerrar ayuda"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-600 text-xs font-black text-slate-300 transition hover:border-slate-400 hover:bg-surface-inset hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
      >
        !
      </button>
      {panel}
    </>
  );
}
