export function agencyPaymentApplicationTotal(applications: ReadonlyArray<{ amountCents: number }>) {
  return applications.reduce((total, application) => total + application.amountCents, 0);
}

export function agencyVisitCanClose(input: { requested: number; confirmed: number; differenceReason?: string }) {
  return Number.isSafeInteger(input.requested)
    && Number.isSafeInteger(input.confirmed)
    && input.requested >= 0
    && input.confirmed >= 0
    && (input.requested === input.confirmed || Boolean(input.differenceReason?.trim()));
}
