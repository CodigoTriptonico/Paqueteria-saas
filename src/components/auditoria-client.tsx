"use client";

import { useSearchParams } from "next/navigation";
import { EstadisticasAuditoriaPanel } from "@/components/estadisticas/auditoria-panel";

export function AuditoriaClient() {
  const searchParams = useSearchParams();
  const shipmentId = searchParams.get("shipment");

  return <EstadisticasAuditoriaPanel selectedShipmentId={shipmentId} />;
}
