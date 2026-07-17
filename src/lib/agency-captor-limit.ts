export const demoAgenciesPerCaptor = 3;

export function isCaptorAgencyLimitError(message: string) {
  return message.includes("CAPTOR_AGENCY_LIMIT_REACHED");
}

export function captorAgencyLimitMessage(limit = demoAgenciesPerCaptor) {
  return `Este captador ya tiene las ${limit} agencias permitidas durante la demo.`;
}
