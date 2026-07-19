/** Contextos donde el usuario puede elegir paleta propia (por página / listado). */
export const UI_SURFACE_CONTEXT_IDS = [
  "logistics.tasks",
  "shipments.tracking",
  "conductor.tasks",
  "inventory.items",
  "audit.shipments",
  "warehouse.intake",
  "warehouse.inventory",
  "warehouse.pallets",
  "stats.sales",
  "timeclock.admin",
  "sale.senderCard",
  "sale.recipientCard",
] as const;

export type UiSurfaceContextId = (typeof UI_SURFACE_CONTEXT_IDS)[number];

export type UiSurfaceContextKind = "listRow" | "personCard";

export type UiSurfaceContextMeta = {
  id: UiSurfaceContextId;
  label: string;
  kind: UiSurfaceContextKind;
  description: string;
  /** Si la página permite alternar filas / tarjetas desde el sidebar. */
  supportsViewLayout?: boolean;
};

export const UI_SURFACE_CONTEXTS: UiSurfaceContextMeta[] = [
  {
    id: "logistics.tasks",
    label: "Logística",
    kind: "listRow",
    description: "Filas del listado de tareas e invoices.",
    supportsViewLayout: true,
  },
  {
    id: "shipments.tracking",
    label: "Seguimiento",
    kind: "listRow",
    description: "Filas del listado de envíos.",
    supportsViewLayout: true,
  },
  {
    id: "conductor.tasks",
    label: "Conductor",
    kind: "listRow",
    description: "Filas de tareas del conductor.",
    supportsViewLayout: true,
  },
  {
    id: "inventory.items",
    label: "Inventario",
    kind: "listRow",
    description: "Filas y tarjetas de los artículos de inventario.",
    supportsViewLayout: true,
  },
  {
    id: "audit.shipments",
    label: "Auditoría",
    kind: "listRow",
    description: "Filas y tarjetas de los invoices auditados.",
    supportsViewLayout: true,
  },
  {
    id: "warehouse.intake",
    label: "Ingreso a bodega",
    kind: "listRow",
    description: "Filas y tarjetas de las cajas recibidas.",
    supportsViewLayout: true,
  },
  {
    id: "warehouse.inventory",
    label: "Bodega",
    kind: "listRow",
    description: "Filas y tarjetas de las cajas en bodega.",
    supportsViewLayout: true,
  },
  {
    id: "warehouse.pallets",
    label: "Paletas",
    kind: "listRow",
    description: "Filas y tarjetas de cajas para paletizar.",
    supportsViewLayout: true,
  },
  {
    id: "stats.sales",
    label: "Estadísticas ventas",
    kind: "listRow",
    description: "Filas del panel de ventas.",
    supportsViewLayout: true,
  },
  {
    id: "timeclock.admin",
    label: "Control horario",
    kind: "listRow",
    description: "Filas de empleados y registros.",
    supportsViewLayout: false,
  },
  {
    id: "sale.senderCard",
    label: "Venta · remitente",
    kind: "personCard",
    description: "Color por defecto al crear un remitente nuevo.",
    supportsViewLayout: true,
  },
  {
    id: "sale.recipientCard",
    label: "Venta · destinatario",
    kind: "personCard",
    description: "Color por defecto al crear un destinatario nuevo.",
    supportsViewLayout: true,
  },
];

export function isUiSurfaceContextId(value: string): value is UiSurfaceContextId {
  return (UI_SURFACE_CONTEXT_IDS as readonly string[]).includes(value);
}

export function uiSurfaceContextMeta(id: UiSurfaceContextId) {
  return UI_SURFACE_CONTEXTS.find((entry) => entry.id === id)!;
}

export function surfaceContextSupportsViewLayout(id: UiSurfaceContextId) {
  return uiSurfaceContextMeta(id).supportsViewLayout !== false;
}
