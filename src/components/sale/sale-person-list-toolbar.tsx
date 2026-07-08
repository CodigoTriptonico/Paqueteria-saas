"use client";

import { type ReactNode } from "react";
import {
  flowPersonToolbarActionsClass,
  flowPersonToolbarCountClass,
  flowPersonToolbarRecentsClass,
  flowPersonToolbarSearchSlotClass,
  flowPersonToolbarShellClass,
  flowToolbarInlineCreateClass,
} from "@/components/flow-form-styles";
import { ViewLayoutToggle } from "@/components/view-layout-toggle";
import type { ViewLayout } from "@/lib/view-layout";

type SalePersonListToolbarProps = {
  search: ReactNode;
  viewLayout: ViewLayout;
  onViewLayoutToggle: () => void;
  createIcon: ReactNode;
  createLabel: string;
  createShortLabel: string;
  onCreate: () => void;
  recents?: ReactNode;
  countLabel?: string;
};

export function SalePersonListToolbar({
  search,
  viewLayout,
  onViewLayoutToggle,
  createIcon,
  createLabel,
  createShortLabel,
  onCreate,
  recents,
  countLabel,
}: SalePersonListToolbarProps) {
  return (
    <div className={flowPersonToolbarShellClass}>
      {recents ? <div className={flowPersonToolbarRecentsClass}>{recents}</div> : null}
      <div className={flowPersonToolbarSearchSlotClass}>{search}</div>
      <div className={flowPersonToolbarActionsClass}>
        {countLabel ? (
          <span className={flowPersonToolbarCountClass} aria-live="polite">
            {countLabel}
          </span>
        ) : null}
        <ViewLayoutToggle layout={viewLayout} onToggle={onViewLayoutToggle} variant="inline" />
        <button type="button" onClick={onCreate} className={flowToolbarInlineCreateClass}>
          {createIcon}
          <span className="hidden sm:inline">{createLabel}</span>
          <span className="sm:hidden">{createShortLabel}</span>
        </button>
      </div>
    </div>
  );
}
