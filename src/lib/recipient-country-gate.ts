/** A recipient may only be created for a destination configured by the organization. */
export function recipientCountrySetupRequired(countries: readonly string[]) {
  return !countries.some((country) => country.trim().length > 0);
}
