export type ConfigSectionId =
  | "organization"
  | "prices"
  | "distributors"
  | "deliveries"
  | "appearance"
  | "timeclock";

export type ConfigSectionLabel = {
  title: string;
  text: string;
};

/** Títulos y textos del menú de Configuración, alineados a lo que hace cada sección. */
export const CONFIG_SECTION_LABELS: Record<ConfigSectionId, ConfigSectionLabel> = {
  organization: {
    title: "Organización",
    text: "Empresa, plan, usuarios, roles y bodegas.",
  },
  prices: {
    title: "Países y precios",
    text: "Destinos, tiempos de entrega y catálogo de productos.",
  },
  distributors: {
    title: "Distribuidores",
    text: "Proveedores y costos de compra por país.",
  },
  deliveries: {
    title: "Entrega y recolección",
    text: "Depósito mínimo, horarios y tarifas de domicilio.",
  },
  appearance: {
    title: "Apariencia",
    text: "Tema y colores de la interfaz.",
  },
  timeclock: {
    title: "Control de horario",
    text: "Empleados, marcaciones y reportes de asistencia.",
  },
};
