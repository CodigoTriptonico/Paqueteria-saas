export type LogisticsEvidenceItem = {
  id: string;
  shipmentCode: string;
  taskId: string | null;
  evidenceUrl: string;
  createdAt: string;
  title: string;
};

export function mapLogisticsEvidenceFromHistory(rows: ReadonlyArray<{
  id: string;
  title: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}>) {
  const items: LogisticsEvidenceItem[] = [];

  for (const row of rows) {
    const evidenceUrl =
      typeof row.metadata?.evidenceUrl === "string" ? row.metadata.evidenceUrl : "";

    if (!evidenceUrl) {
      continue;
    }

    items.push({
      id: row.id,
      shipmentCode: String(row.metadata?.shipmentCode || ""),
      taskId: typeof row.metadata?.taskId === "string" ? row.metadata.taskId : null,
      evidenceUrl,
      createdAt: row.created_at,
      title: row.title,
    });
  }

  return items;
}
