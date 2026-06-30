import type { InlineSearchPickerOption } from "@/components/inline-search-picker";
import { countryFlagIcon } from "@/components/country-flag";
import type { CountryOption } from "@/lib/country-options";

export function countryNamePickerOption(
  name: string,
  value: string = name,
): InlineSearchPickerOption {
  return {
    value,
    label: name,
    icon: countryFlagIcon(name),
  };
}

export function countryCatalogPickerOption(country: CountryOption): InlineSearchPickerOption {
  return {
    value: country.code || country.name,
    label: country.name,
    searchText: country.code,
    icon: countryFlagIcon(country),
  };
}

export function countryNamesPickerOptions(names: string[]): InlineSearchPickerOption[] {
  return names.map((name) => countryNamePickerOption(name));
}

export function countryCatalogPickerOptions(
  countries: CountryOption[],
): InlineSearchPickerOption[] {
  return countries.map((country) => countryCatalogPickerOption(country));
}
