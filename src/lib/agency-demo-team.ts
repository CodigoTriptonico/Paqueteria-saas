export const agencyDemoAdministratorLimit = 1;
export const agencyDemoSellerLimit = 2;
export const agencyDemoTeamSize = agencyDemoAdministratorLimit + agencyDemoSellerLimit;

const agencyDemoTeamErrors: Record<string, string> = {
  AGENCY_ADMIN_REQUIRED: "La agencia debe conservar a su administrador responsable.",
  AGENCY_ADMIN_LIMIT_REACHED: "Esta agencia ya tiene a su administrador responsable.",
  AGENCY_SELLER_LIMIT_REACHED: `Esta agencia ya tiene sus ${agencyDemoSellerLimit} vendedores permitidos durante la demo.`,
  AGENCY_ROLE_NOT_ALLOWED: "Las agencias de la demo solo pueden tener administrador y vendedores.",
};

export function agencyDemoTeamErrorMessage(message: string) {
  const matched = Object.entries(agencyDemoTeamErrors).find(([code]) => message.includes(code));
  return matched ? matched[1] : message;
}
