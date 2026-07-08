"use client";

import { ChevronDown, Clock, Package } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { personFullName, type Sender } from "@/components/sale/venta-parts";

type SaleRecentSendersProps = {
  senders: Sender[];
  onChoose: (sender: Sender) => void;
  onQuickEmptyBox?: (sender: Sender) => void;
};

type RecentMenuAnchorRect = Pick<DOMRect, "bottom" | "left">;

export type RecentMenuPositionOptions = {
  viewportWidth: number;
  viewportHeight: number;
  panelWidth?: number;
  panelMaxHeight?: number;
  gap?: number;
};

export function resolveRecentSendersMenuPosition(
  anchor: RecentMenuAnchorRect,
  {
    viewportWidth,
    viewportHeight,
    panelWidth = 260,
    panelMaxHeight = 288,
    gap = 6,
  }: RecentMenuPositionOptions,
) {
  const maxLeft = Math.max(gap, viewportWidth - panelWidth - gap);
  const left = Math.min(Math.max(gap, anchor.left), maxLeft);
  const maxTop = Math.max(gap, viewportHeight - panelMaxHeight - gap);
  const top = Math.min(anchor.bottom + gap, maxTop);

  return {
    left,
    top: Math.max(gap, top),
  };
}

export function SaleRecentSenders({
  senders,
  onChoose,
  onQuickEmptyBox,
}: SaleRecentSendersProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const firstSenderName = senders[0] ? personFullName(senders[0]) : "";

  function updatePosition() {
    const anchor = buttonRef.current?.getBoundingClientRect();

    if (!anchor) {
      return;
    }

    setPosition(
      resolveRecentSendersMenuPosition(anchor, {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }),
    );
  }

  function chooseSender(sender: Sender) {
    onChoose(sender);
    setOpen(false);
  }

  function quickEmptyBox(sender: Sender) {
    onQuickEmptyBox?.(sender);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  if (!senders.length) {
    return null;
  }

  return (
    <div className="flex min-w-0 items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) {
            updatePosition();
          }
        }}
        className="inline-flex h-8 max-w-[14rem] shrink-0 items-center gap-1.5 rounded-lg border border-black bg-[#27342f] px-2 text-[11px] font-black text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:bg-[#304239] hover:text-emerald-100 aria-expanded:bg-[#304239] aria-expanded:text-emerald-100"
        title={`Remitentes recientes: ${senders.map(personFullName).join(", ")}`}
        aria-label="Abrir remitentes recientes"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
      >
        <Clock className="h-3 w-3" aria-hidden />
        <span className="hidden uppercase tracking-wide text-slate-400 sm:inline">Recientes</span>
        <span className="max-w-[6.5rem] truncate text-left sm:max-w-[7.5rem]">{firstSenderName}</span>
        <span className="rounded bg-emerald-400/10 px-1 text-[10px] tabular-nums text-emerald-300">
          {senders.length}
        </span>
        <ChevronDown
          className={`h-3 w-3 text-slate-400 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label="Remitentes recientes"
              className="fixed z-[140] max-h-72 w-[16.25rem] overflow-hidden rounded-lg border border-black bg-[#101820] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
              style={{ left: position.left, top: position.top }}
            >
              <div className="flex items-center gap-1.5 border-b border-black/70 px-2 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500">
                <Clock className="h-3 w-3" aria-hidden />
                Recientes
              </div>
              <div className="max-h-60 overflow-y-auto py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {senders.map((sender) => (
                  <div
                    key={sender.id}
                    className="flex items-center overflow-hidden rounded-md text-slate-200 hover:bg-[#1f2a25]"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => chooseSender(sender)}
                      className="min-w-0 flex-1 px-2.5 py-2 text-left text-[12px] font-black transition hover:text-emerald-100"
                      title={personFullName(sender)}
                    >
                      <span className="block truncate">{personFullName(sender)}</span>
                    </button>
                    {onQuickEmptyBox ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => quickEmptyBox(sender)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center border-l border-black/55 text-emerald-300 transition hover:bg-emerald-400/10 hover:text-emerald-200"
                        title={`Venta rápida: ${personFullName(sender)}`}
                        aria-label={`Venta rápida caja vacía: ${personFullName(sender)}`}
                      >
                        <Package className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
