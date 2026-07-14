type SaleContextTargetType = "remitente" | "destinatario" | "caja";

export type SaleContextTargetData = {
  title: string;
  type: SaleContextTargetType;
  targetKey: string;
  phones: string[];
  address: {
    street?: string;
    houseNumber?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  firstName: string;
  lastName: string;
  customerId?: string;
  recipientId?: string;
};

const targetTypes = new Set<SaleContextTargetType>([
  "remitente",
  "destinatario",
  "caja",
]);

export function saleContextTargetData(
  dataset: DOMStringMap,
): SaleContextTargetData | null {
  const type = dataset.saleContextType as SaleContextTargetType | undefined;
  const title = dataset.saleContextTitle;
  const targetKey = dataset.saleContextKey;

  if (!type || !targetTypes.has(type) || !title || !targetKey) {
    return null;
  }

  return {
    title,
    type,
    targetKey,
    phones: dataset.saleContextPhones
      ? dataset.saleContextPhones.split("|").filter(Boolean)
      : [],
    address: {
      street: dataset.saleContextStreet,
      houseNumber: dataset.saleContextHouse,
      neighborhood: dataset.saleContextNeighborhood,
      city: dataset.saleContextCity,
      state: dataset.saleContextState,
      postalCode: dataset.saleContextPostalCode,
      country: dataset.saleContextCountry,
    },
    firstName: dataset.saleContextFirstName || "",
    lastName: dataset.saleContextLastName || "",
    customerId: dataset.saleContextCustomerId,
    recipientId: dataset.saleContextRecipientId,
  };
}
