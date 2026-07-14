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

type SalePersonListToolbarProps = {
  search: ReactNode;
  createIcon: ReactNode;
  createLabel: string;
  createShortLabel: string;
  onCreate: () => void;
  createOnboardingTarget?: string;
  recents?: ReactNode;
  countLabel?: string;
};

export function SalePersonListToolbar({
  search,
  createIcon,
  createLabel,
  createShortLabel,
  onCreate,
  createOnboardingTarget,
  recents,
  countLabel,
}: SalePersonListToolbarProps) {
  return (
    <div className={flowPersonToolbarShellClass}>
      <div className={flowPersonToolbarActionsClass}>
        <button
          type="button"
          onClick={onCreate}
          className={flowToolbarInlineCreateClass}
          data-onboarding-target={createOnboardingTarget}
        >
          {createIcon}
          <span className="hidden sm:inline">{createLabel}</span>
          <span className="sm:hidden">{createShortLabel}</span>
        </button>
        {countLabel ? (
          <span className={flowPersonToolbarCountClass} aria-live="polite">
            {countLabel}
          </span>
        ) : null}
      </div>
      {recents ? <div className={flowPersonToolbarRecentsClass}>{recents}</div> : null}
      <div className={flowPersonToolbarSearchSlotClass}>{search}</div>
    </div>
  );
}
