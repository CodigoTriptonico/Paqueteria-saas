import {
  hasRouteGeo,
  logisticsZoneKey,
  type LogisticsRouteStopAddress,
} from "@/lib/logistics-routing";

export type CustomerRouteAssignmentRequestStatus = "pending" | "approved" | "rejected";

export type CustomerRouteAssignmentOutcome = "assigned" | "pending_approval";

export type CustomerRouteZoneInput = {
  city: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
};

export type ActiveCustomerRouteVerification = {
  id: string;
  customerId: string;
  routeTemplateId: string;
  zoneKey: string;
  endedAt: string | null;
};

export function customerZoneKeyFromParts(input: CustomerRouteZoneInput): string {
  const address: LogisticsRouteStopAddress = {
    source: "customer",
    name: "",
    phone: "",
    street: "",
    houseNumber: "",
    addressReference: "",
    neighborhood: "",
    city: input.city || "",
    state: "",
    postalCode: input.postalCode || "",
    country: "",
    formattedAddress: "",
    placeId: "",
    lat: input.lat,
    lng: input.lng,
  };

  return logisticsZoneKey(address);
}

export function customerHasRouteGeo(input: CustomerRouteZoneInput) {
  return hasRouteGeo({ lat: input.lat, lng: input.lng });
}

function isActiveCustomerRouteVerification(
  verification: Pick<ActiveCustomerRouteVerification, "endedAt"> | null | undefined,
) {
  return Boolean(verification && !verification.endedAt);
}

export function customerRouteVerificationMatchesZone(
  verification: Pick<ActiveCustomerRouteVerification, "zoneKey" | "endedAt"> | null | undefined,
  currentZoneKey: string,
) {
  if (!isActiveCustomerRouteVerification(verification)) {
    return false;
  }

  return verification!.zoneKey === currentZoneKey && currentZoneKey !== "falta-geo";
}

export function shouldAutoAcceptCustomerRouteAssignment(input: {
  verification: Pick<ActiveCustomerRouteVerification, "zoneKey" | "endedAt" | "routeTemplateId"> | null | undefined;
  routeTemplateId: string;
  currentZoneKey: string;
}) {
  if (!input.verification) {
    return false;
  }

  if (input.verification.routeTemplateId !== input.routeTemplateId) {
    return false;
  }

  return customerRouteVerificationMatchesZone(input.verification, input.currentZoneKey);
}

export function resolveCustomerRouteAssignmentOutcome(input: {
  verification: Pick<ActiveCustomerRouteVerification, "zoneKey" | "endedAt" | "routeTemplateId"> | null | undefined;
  routeTemplateId: string;
  currentZoneKey: string;
}): CustomerRouteAssignmentOutcome {
  return shouldAutoAcceptCustomerRouteAssignment(input) ? "assigned" : "pending_approval";
}

export function zoneChangeShouldRevokeVerification(input: {
  previousZoneKey: string;
  nextZoneKey: string;
}) {
  return input.previousZoneKey !== input.nextZoneKey;
}

export const CUSTOMER_ROUTE_PENDING_APPROVAL_LABEL = "Pendiente aprobación logística";
export const CUSTOMER_ROUTE_ZONE_CHANGE_REASON = "Cambio de dirección o zona del remitente";
