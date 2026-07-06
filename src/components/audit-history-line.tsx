import type { ActivityHistoryRow } from "@/app/actions/history";
import {
  buildAuditHistorySegments,
  type AuditHistoryLineSegment,
} from "@/lib/shipment-step-history";

const auditBadgeClass = {
  date: "border-black/40 bg-surface-inset text-slate-400",
  invoice: "border-emerald-700/35 bg-emerald-400/10 text-emerald-200",
  moment: "border-amber-700/30 bg-amber-950/30 text-amber-200/90",
  actor: "border-black/40 bg-surface-inset text-slate-300",
} as const;

type AuditHistoryChunk = {
  segments: AuditHistoryLineSegment[];
  nowrap: boolean;
};

function AuditHistoryBadge({
  children,
  tone,
}: {
  children: string;
  tone: keyof typeof auditBadgeClass;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-md border px-1.5 py-0.5 text-[10px] font-black leading-tight ${auditBadgeClass[tone]} ${tone === "date" ? "tabular-nums" : ""}`}
    >
      {children}
    </span>
  );
}

function AuditHistorySegment({ segment }: { segment: AuditHistoryLineSegment }) {
  if (segment.type === "text") {
    return <span className="text-slate-300">{segment.value}</span>;
  }

  return <AuditHistoryBadge tone={segment.type}>{segment.value}</AuditHistoryBadge>;
}

function shouldPairSegments(left: AuditHistoryLineSegment, right: AuditHistoryLineSegment) {
  if (left.type === "text" && right.type === "date") {
    return true;
  }

  if (left.type === "text" && left.value === "vendedor encargado" && right.type === "actor") {
    return true;
  }

  if (left.type === "text" && left.value === "por" && right.type === "actor") {
    return true;
  }

  return false;
}

function buildAuditHistoryChunks(segments: AuditHistoryLineSegment[]): AuditHistoryChunk[] {
  const chunks: AuditHistoryChunk[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const next = segments[index + 1];

    if (next && shouldPairSegments(segment, next)) {
      chunks.push({ segments: [segment, next], nowrap: true });
      index += 1;
      continue;
    }

    chunks.push({ segments: [segment], nowrap: false });
  }

  return chunks;
}

export function AuditHistoryLine({ entry }: { entry: ActivityHistoryRow }) {
  const chunks = buildAuditHistoryChunks(buildAuditHistorySegments(entry));

  if (!chunks.length) {
    return null;
  }

  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs font-bold leading-snug">
      {chunks.map((chunk, index) => (
        <span
          key={`chunk-${index}`}
          className={`inline-flex items-center gap-1 ${chunk.nowrap ? "shrink-0 whitespace-nowrap" : ""}`}
        >
          {index > 0 ? <span className="text-slate-600" aria-hidden>·</span> : null}
          {chunk.segments.map((segment, segmentIndex) => (
            <AuditHistorySegment key={`${segment.type}-${segmentIndex}`} segment={segment} />
          ))}
        </span>
      ))}
    </p>
  );
}
