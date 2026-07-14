export type CreateOrgStep = "data" | "done";

export const createOrgSteps: { id: CreateOrgStep; label: string }[] = [
  { id: "data", label: "Datos" },
  { id: "done", label: "Listo" },
];
