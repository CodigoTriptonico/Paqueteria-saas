"use client";

import { History } from "lucide-react";
import { useEffect } from "react";

export type EnviosShipmentMenuState = {
  shipmentId: string;
  shipmentCode: string;
  x: number;
  y: number;
} | null;

type EnviosShipmentContextMenuProps = {
  menu: EnviosShipmentMenuState;
  onClose: () => void;
  onOpenAudit: (shipmentId: string) => void;
};

export function EnviosShipmentContextMenu({
  menu,
  onClose,
  onOpenAudit,
}: EnviosShipmentContextMenuProps) {
  useEffect(() => {
    if (!menu) {
      return;
    }

    function closeOnPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (document.getElementById("envios-shipment-context-menu")?.contains(target)) {
        return;
      }

      onClose();
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menu, onClose]);

  if (!menu) {
    return null;
  }

  return (
    <div
      id="envios-shipment-context-menu"
      className="fixed z-50 w-56 overflow-hidden rounded-xl border border-black bg-surface-panel p-2 shadow-2xl"
      style={{ left: menu.x, top: menu.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="border-b border-black px-3 py-2">
        <p className="text-xs font-black uppercase text-slate-500">Opciones</p>
        <p className="truncate text-sm font-black text-[#f8fafc]">{menu.shipmentCode}</p>
      </div>

      <button
        type="button"
        onClick={() => {
          onOpenAudit(menu.shipmentId);
          onClose();
        }}
        className="mt-1 flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left hover:border-black hover:bg-surface-card"
      >
        <span className="text-emerald-300">
          <History className="h-5 w-5" />
        </span>
        <span className="text-sm font-black text-[#f8fafc]">Auditoría</span>
      </button>
    </div>
  );
}
