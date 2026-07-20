export type ConfigMenuSectionId =
  | "organization"
  | "prices"
  | "distributors"
  | "deliveries"
  | "appearance"
  | "timeclock";

export type ConfigMenuGroup = {
  id: string;
  title: string;
  description: string;
  sectionIds: ConfigMenuSectionId[];
};

export const CONFIG_MENU_GROUPS: ConfigMenuGroup[] = [
  {
    id: "operation",
    title: "Operación",
    description: "Precios, catálogo, proveedores y logística del día a día.",
    sectionIds: ["prices", "distributors", "deliveries"],
  },
  {
    id: "administration",
    title: "Administración",
    description: "Empresa, acceso, equipo y apariencia del sistema.",
    sectionIds: ["organization", "timeclock", "appearance"],
  },
];

export const CONFIG_MENU_SECTION_IDS: ConfigMenuSectionId[] = CONFIG_MENU_GROUPS.flatMap(
  (group) => group.sectionIds,
);
