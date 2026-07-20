import type {
  CustomerRecipientRow,
  CustomerWithRecipientsRow,
} from "@/app/actions/customers";

export type SaleRecipient = {
  id: string;
  firstName: string;
  lastName: string;
  country: string;
  phone: string;
  email: string;
  emails: string[];
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state?: string;
  postalCode: string;
  addressReference: string;
  cardStyle: string;
  placeId: string;
  formattedAddress: string;
  addressVerified: boolean;
  lat: number | null;
  lng: number | null;
};

export type SaleSender = {
  id: string;
  referredByCustomerId: string;
  firstName: string;
  lastName: string;
  phones: string[];
  email: string;
  emails: string[];
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  addressReference: string;
  cardStyle: string;
  placeId: string;
  formattedAddress: string;
  addressVerified: boolean;
  lat: number | null;
  lng: number | null;
  recipients: SaleRecipient[];
};

export function customerRowToSender(row: CustomerWithRecipientsRow): SaleSender {
  return {
    id: row.id,
    referredByCustomerId: row.referredByCustomerId,
    firstName: row.firstName,
    lastName: row.lastName,
    phones: row.phones,
    email: row.email,
    emails: row.emails,
    street: row.street,
    houseNumber: row.houseNumber,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    addressReference: row.addressReference,
    cardStyle: row.cardStyle,
    placeId: row.placeId,
    formattedAddress: row.formattedAddress,
    addressVerified: row.addressVerified,
    lat: row.lat,
    lng: row.lng,
    recipients: row.recipients.map(recipientRowToSaleRecipient),
  };
}

export function recipientRowToSaleRecipient(row: CustomerRecipientRow): SaleRecipient {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    country: row.country,
    phone: row.phone,
    email: row.email,
    emails: row.emails,
    street: row.street,
    houseNumber: row.houseNumber,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    addressReference: row.addressReference,
    cardStyle: row.cardStyle,
    placeId: row.placeId,
    formattedAddress: row.formattedAddress,
    addressVerified: row.addressVerified,
    lat: row.lat,
    lng: row.lng,
  };
}
