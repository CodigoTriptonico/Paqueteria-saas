"use client";

import { ChevronRight, Copy, Edit3, History, MoreHorizontal, Package, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { ContextMenuFlyout } from "@/components/context-menu-flyout";
import type { ContextMenuState } from "@/components/sale/venta-parts";

type CopyGroup = {
  label: string;
  items: { label: string; value?: string }[];
};

type EditGroup = {
  label: string;
  text: string;
};

type MoreAction = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
};

type SaleContextMenuProps = {
  menu: ContextMenuState;
  activeCopyGroup: string | null;
  copyGroups: CopyGroup[];
  editGroups: EditGroup[];
  onActiveCopyGroupChange: (label: string | null) => void;
  onEdit: () => void;
  onCopyValue: (value?: string) => void;
  moreActions?: MoreAction[];
  onViewHistory?: () => void;
  onQuickEmptyBox?: () => void;
  onAddReferral?: () => void;
};

export function SaleContextMenu({
  menu,
  activeCopyGroup,
  copyGroups,
  editGroups,
  onActiveCopyGroupChange,
  onEdit,
  onCopyValue,
  moreActions = [],
  onViewHistory,
  onQuickEmptyBox,
  onAddReferral,
}: SaleContextMenuProps) {
  const resolvedMoreActions: MoreAction[] =
    moreActions.length > 0
      ? moreActions
      : [
          ...(menu.type === "remitente" && onViewHistory
            ? [
                {
                  label: "Historial del cliente",
                  icon: <History className="h-5 w-5" />,
                  onClick: onViewHistory,
                },
              ]
            : []),
          ...(menu.type === "remitente" && onAddReferral
            ? [
                {
                  label: "Agregar referido",
                  icon: <Plus className="h-5 w-5" />,
                  onClick: onAddReferral,
                },
              ]
            : []),
          ...(menu.type === "destinatario" && onViewHistory
            ? [
                {
                  label: "Historial del destinatario",
                  icon: <History className="h-5 w-5" />,
                  onClick: onViewHistory,
                },
              ]
            : []),
        ];

  return (
    <div
      className="fixed z-50 w-72 overflow-visible rounded-xl border border-black bg-surface-panel p-2 shadow-2xl"
      style={{ left: menu.x, top: menu.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="border-b border-black px-3 py-2">
        <p className="text-xs font-black uppercase text-slate-500">{menu.type}</p>
        <p className="truncate text-base font-black">{menu.title}</p>
      </div>

      {menu.type === "remitente" && onQuickEmptyBox ? (
        <button
          type="button"
          onClick={onQuickEmptyBox}
          className="mt-1 flex h-11 w-full items-center gap-3 rounded-lg border border-emerald-700/35 bg-emerald-400/10 px-3 text-left font-black text-emerald-100 hover:bg-emerald-400/15"
        >
          <Package className="h-5 w-5" />
          <span className="flex-1">Venta rápida</span>
        </button>
      ) : null}

      {menu.type !== "caja" ? (
        <ContextMenuFlyout
          title="Editar info"
          icon={<Edit3 className="h-5 w-5" />}
          onMouseEnter={() => onActiveCopyGroupChange(null)}
        >
          <p className="px-3 pb-2 text-xs font-black uppercase text-slate-500">Editar</p>
          {editGroups.map((group) => (
            <button
              key={group.label}
              type="button"
              className="grid w-full gap-1 rounded-lg border border-transparent px-3 py-2.5 text-left hover:border-black hover:bg-surface-card"
              onClick={onEdit}
            >
              <span className="text-sm font-black text-[#f8fafc]">{group.label}</span>
              <span className="text-[11px] font-bold text-slate-500">{group.text}</span>
            </button>
          ))}
        </ContextMenuFlyout>
      ) : null}

      <ContextMenuFlyout
        title="Copiar"
        icon={<Copy className="h-5 w-5" />}
        onMouseEnter={() => onActiveCopyGroupChange(null)}
      >
        <p className="px-3 pb-2 text-xs font-black uppercase text-slate-500">Copiar</p>
        {copyGroups.map((group) => (
          <div key={group.label} className="relative">
            <button
              type="button"
              className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-black hover:bg-surface-card"
              onMouseEnter={() => onActiveCopyGroupChange(group.items.length ? group.label : null)}
              onClick={() => {
                if (group.items.length === 0) {
                  onCopyValue(undefined);
                }
              }}
            >
              <span className="flex-1">{group.label}</span>
              {group.items.length > 0 ? <ChevronRight className="h-4 w-4 text-slate-500" /> : null}
            </button>

            {group.items.length > 0 && activeCopyGroup === group.label ? (
              <div className="absolute left-[calc(100%-1px)] top-0 z-50 w-80 rounded-xl border border-black bg-surface-panel p-2 opacity-100 shadow-2xl">
                <p className="px-3 pb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="grid w-full gap-1 rounded-lg border border-transparent px-3 py-2.5 text-left hover:border-black hover:bg-surface-card"
                    onClick={() => onCopyValue(item.value)}
                  >
                    <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                      {item.label}
                    </span>
                    {item.value ? (
                      <span className="whitespace-normal text-[15px] font-semibold leading-snug text-[#f8fafc]">
                        {item.value}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </ContextMenuFlyout>

      {resolvedMoreActions.length > 0 ? (
        <ContextMenuFlyout
          title="Más"
          icon={<MoreHorizontal className="h-5 w-5" />}
          onMouseEnter={() => onActiveCopyGroupChange(null)}
        >
          <p className="px-3 pb-2 text-xs font-black uppercase text-slate-500">Más</p>
          {resolvedMoreActions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left font-black hover:bg-surface-card"
              onClick={action.onClick}
            >
              {action.icon}
              <span className="flex-1">{action.label}</span>
            </button>
          ))}
        </ContextMenuFlyout>
      ) : null}
    </div>
  );
}
