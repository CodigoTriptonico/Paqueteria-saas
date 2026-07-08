import type { LogisticsRouteStopAddress, LogisticsTaskType } from "@/lib/logistics-routing";

export type LogisticsCustomerAddressRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phones?: string[] | null;
  phone?: string | null;
  street?: string | null;
  house_number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  place_id?: string | null;
  formatted_address?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
};

export type LogisticsShipmentAddressSource = {
  customerId?: string | null;
  customerName: string;
  recipientSnapshot?: Record<string, unknown> | null;
};

function clean(value: unknown) {
  return String(value || "").trim();
}

function readNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formattedAddressFromParts(input: {
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}) {
  return [
    [input.street, input.houseNumber].filter(Boolean).join(" "),
    input.neighborhood,
    [input.city, input.state, input.postalCode].filter(Boolean).join(" "),
    input.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export function routeAddressFromCustomer(
  row: LogisticsCustomerAddressRow | null | undefined,
): LogisticsRouteStopAddress | null {
  if (!row) {
    return null;
  }

  const firstName = clean(row.first_name);
  const lastName = clean(row.last_name);
  const phones = Array.isArray(row.phones) ? row.phones : [];
  const street = clean(row.street);
  const houseNumber = clean(row.house_number);
  const neighborhood = clean(row.neighborhood);
  const city = clean(row.city);
  const state = clean(row.state);
  const postalCode = clean(row.postal_code);
  const country = clean(row.country || "USA");
  const formattedAddress =
    clean(row.formatted_address) ||
    formattedAddressFromParts({ street, houseNumber, neighborhood, city, state, postalCode, country });

  return {
    source: "customer",
    name: [firstName, lastName].filter(Boolean).join(" ").trim(),
    phone: clean(row.phone || phones[0]),
    street,
    houseNumber,
    neighborhood,
    city,
    state,
    postalCode,
    country,
    formattedAddress,
    placeId: clean(row.place_id),
    lat: readNumber(row.lat),
    lng: readNumber(row.lng),
  };
}

export function routeAddressFromRecipientSnapshot(
  snapshot: Record<string, unknown> | null | undefined,
  fallbackName = "",
): LogisticsRouteStopAddress {
  const street = clean(snapshot?.street);
  const houseNumber = clean(snapshot?.houseNumber);
  const neighborhood = clean(snapshot?.neighborhood);
  const city = clean(snapshot?.city);
  const state = clean(snapshot?.state);
  const postalCode = clean(snapshot?.postalCode);
  const country = clean(snapshot?.country);
  const formattedAddress =
    clean(snapshot?.formattedAddress) ||
    formattedAddressFromParts({ street, houseNumber, neighborhood, city, state, postalCode, country });

  return {
    source: snapshot ? "recipient_snapshot" : "unknown",
    name:
      [clean(snapshot?.firstName), clean(snapshot?.lastName)].filter(Boolean).join(" ").trim() ||
      fallbackName,
    phone: clean(snapshot?.phone),
    street,
    houseNumber,
    neighborhood,
    city,
    state,
    postalCode,
    country,
    formattedAddress,
    placeId: clean(snapshot?.placeId),
    lat: readNumber(snapshot?.lat),
    lng: readNumber(snapshot?.lng),
  };
}

export function routeAddressForLogisticsTask(
  shipment: LogisticsShipmentAddressSource,
  taskType: LogisticsTaskType,
  customerById: Map<string, LogisticsCustomerAddressRow>,
) {
  const snapshotAddress = routeAddressFromRecipientSnapshot(
    shipment.recipientSnapshot,
    shipment.customerName,
  );
  const customerAddress = shipment.customerId
    ? routeAddressFromCustomer(customerById.get(shipment.customerId))
    : null;

  if (customerAddress) {
    if (customerAddress.lat !== null && customerAddress.lng !== null) {
      return customerAddress;
    }

    if (snapshotAddress.lat !== null && snapshotAddress.lng !== null) {
      return {
        ...customerAddress,
        formattedAddress: snapshotAddress.formattedAddress || customerAddress.formattedAddress,
        placeId: snapshotAddress.placeId || customerAddress.placeId,
        lat: snapshotAddress.lat,
        lng: snapshotAddress.lng,
      };
    }

    return customerAddress;
  }

  return snapshotAddress;
}
