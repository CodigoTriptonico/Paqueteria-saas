export type PackageCustodyEventType =
  | "created"
  | "collected"
  | "unloaded"
  | "intake_confirmed"
  | "placed_in_warehouse"
  | "palletized"
  | "released_to_carrier"
  | "manual_handoff"
  | "status_correction";

export const packageCustodyEventLabel: Record<PackageCustodyEventType, string> = {
  created: "Caja registrada",
  collected: "Recogida y cargada con conductor",
  unloaded: "Descargada en ingreso de bodega",
  intake_confirmed: "Ingreso a bodega confirmado",
  placed_in_warehouse: "Ubicada en bodega",
  palletized: "Asignada a paleta",
  released_to_carrier: "Entregada al proveedor",
  manual_handoff: "Traspaso recibido",
  status_correction: "Estado de custodia registrado",
};

export function custodyCurrentLabel(holderLabel: string) {
  return holderLabel.trim() || "Custodia sin identificar";
}
