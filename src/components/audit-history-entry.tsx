import type { ActivityHistoryRow } from "@/app/actions/history";
import { AuditHistoryLine } from "@/components/audit-history-line";
import { shipmentAuditActionLabel } from "@/lib/shipment-audit";
import {
  formatAuditHistoryHeaderLabel,
  stepHistoryTimestamp,
} from "@/lib/shipment-step-history";

const categoryToneClass = {
  sale: "border-emerald-700/35 bg-emerald-950/35 text-emerald-200",
  logistics: "border-sky-700/35 bg-sky-950/35 text-sky-200",
  priority: "border-amber-700/35 bg-amber-950/35 text-amber-200",
  default: "border-black/50 bg-surface-inset text-slate-300",
} as const;

function auditCategoryTone(action: string) {
  if (action === "sale.invoice_priority_updated") {
    return categoryToneClass.priority;
  }

  if (action.startsWith("sale.")) {
    return categoryToneClass.sale;
  }

  if (action.startsWith("shipment.logistics") || action === "shipment.status_updated") {
    return categoryToneClass.logistics;
  }

  return categoryToneClass.default;
}

function AuditHistoryCategoryChip({ action }: { action: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${auditCategoryTone(action)}`}
    >
      {shipmentAuditActionLabel(action)}
    </span>
  );
}

type AuditHistoryEntryProps = {
  entry: ActivityHistoryRow;
  className?: string;
};

export function AuditHistoryEntry({ entry, className = "" }: AuditHistoryEntryProps) {
  const actionLabel = shipmentAuditActionLabel(entry.action);
  const headerLabel = formatAuditHistoryHeaderLabel(entry, actionLabel);
  const timestamp = stepHistoryTimestamp(entry);
  const showInvoice = headerLabel && headerLabel !== actionLabel;

  return (
    <article className={`rounded-lg border border-black/70 bg-surface-card px-3 py-2.5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <AuditHistoryCategoryChip action={entry.action} />
            {showInvoice ? (
              <span className="text-[11px] font-black tracking-wide text-emerald-300">{headerLabel}</span>
            ) : null}
          </div>
          <AuditHistoryLine entry={entry} />
        </div>
        {timestamp.relative ? (
          <time
            className="shrink-0 pt-0.5 text-[10px] font-bold tabular-nums text-slate-500"
            dateTime={entry.createdAt}
            title={timestamp.absolute || undefined}
          >
            {timestamp.relative}
          </time>
        ) : null}
      </div>
    </article>
  );
}
