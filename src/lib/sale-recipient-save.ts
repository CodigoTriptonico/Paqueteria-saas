export type RecipientAddressValidationStatus = "idle" | "checking" | "valid" | "invalid";

export function recipientHasRequiredAddress(fields: {
  street: string;
  city: string;
  state: string;
  postalCode: string;
}) {
  return Boolean(
    fields.street.trim() &&
      fields.city.trim() &&
      fields.state.trim() &&
      fields.postalCode.trim(),
  );
}

export function recipientAddressSatisfied(
  validationStatus: RecipientAddressValidationStatus,
  skipVerification: boolean,
  hasRequiredAddress: boolean,
) {
  if (validationStatus === "valid") {
    return true;
  }

  return skipVerification && hasRequiredAddress;
}

export function recipientSaveEnabled(params: {
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  duplicateRecipient: boolean;
  validationStatus: RecipientAddressValidationStatus;
  skipVerification: boolean;
  hasRequiredAddress: boolean;
}) {
  if (
    !params.firstName.trim() ||
    !params.lastName.trim() ||
    !params.phone.trim() ||
    !params.country.trim()
  ) {
    return false;
  }

  if (params.duplicateRecipient) {
    return true;
  }

  return recipientAddressSatisfied(
    params.validationStatus,
    params.skipVerification,
    params.hasRequiredAddress,
  );
}
