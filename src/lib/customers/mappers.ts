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
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state?: string;
  postalCode: string;
};

export type SaleSender = {
  id: string;
  referredByCustomerId: string;
  firstName: string;
  lastName: string;
  phones: string[];
  email: string;
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
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
    street: row.street,
    houseNumber: row.houseNumber,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
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
    street: row.street,
    houseNumber: row.houseNumber,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
  };
}

export function saleRecipientToRow(recipient: SaleRecipient): CustomerRecipientRow {
  return {
    id: recipient.id,
    firstName: recipient.firstName,
    lastName: recipient.lastName,
    phone: recipient.phone,
    country: recipient.country,
    street: recipient.street,
    houseNumber: recipient.houseNumber,
    neighborhood: recipient.neighborhood,
    city: recipient.city,
    state: recipient.state || "",
    postalCode: recipient.postalCode,
  };
}
