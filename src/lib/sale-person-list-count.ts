export type SalePersonListCountKind = "remitente" | "destinatario";

type FormatSalePersonListCountOptions = {
  kind: SalePersonListCountKind;
  totalCount?: number;
  filtered?: boolean;
};

export function formatSalePersonListCount(
  visibleCount: number,
  { kind, totalCount, filtered = false }: FormatSalePersonListCountOptions,
): string {
  const singular = kind === "remitente" ? "remitente" : "destinatario";
  const plural = kind === "remitente" ? "remitentes" : "destinatarios";

  if (filtered) {
    if (totalCount !== undefined && totalCount !== visibleCount) {
      return `${visibleCount} de ${totalCount}`;
    }

    return visibleCount === 1 ? "1 resultado" : `${visibleCount} resultados`;
  }

  return visibleCount === 1 ? `1 ${singular}` : `${visibleCount} ${plural}`;
}
