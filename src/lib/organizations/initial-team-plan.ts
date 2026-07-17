export const initialTeamPlan = [
  { label: "Administrador", capacity: 1, detail: "Dueño incluido" },
  { label: "Vendedores", capacity: 2, detail: "Hasta 2" },
  { label: "Conductores", capacity: 2, detail: "Hasta 2" },
  { label: "Captadores de agencias", capacity: 2, detail: "Hasta 2" },
] as const;

export const initialAdditionalUserLimit = initialTeamPlan
  .slice(1)
  .reduce((total, role) => total + role.capacity, 0);

export const initialTeamUserLimit = initialTeamPlan.reduce(
  (total, role) => total + role.capacity,
  0,
);

export function formatInitialTeamPlan() {
  return initialTeamPlan
    .map((role) => `${role.capacity} ${role.label.toLocaleLowerCase("es")}`)
    .join(" · ");
}
