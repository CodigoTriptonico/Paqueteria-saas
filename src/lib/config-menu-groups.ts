export type ConfigMenuSectionId =
  | "plan"
  | "prices"
  | "distributors"
  | "inventory"
  | "deliveries"
  | "appearance"
  | "company"
  | "users";

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
    sectionIds: ["prices", "distributors", "inventory", "deliveries"],
  },
  {
    id: "administration",
    title: "Administración",
    description: "Plan, empresa, equipo y apariencia del sistema.",
    sectionIds: ["plan", "company", "users", "appearance"],
  },
];

export const CONFIG_MENU_SECTION_IDS: ConfigMenuSectionId[] = CONFIG_MENU_GROUPS.flatMap(
  (group) => group.sectionIds,
);
