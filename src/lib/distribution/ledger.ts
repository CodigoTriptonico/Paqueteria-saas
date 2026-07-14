export type DistributionLedgerEntry = {
  amount: number;
  kind: "charge" | "payment" | "reversal";
  createdAt: string;
};

export function distributionBalance(entries: DistributionLedgerEntry[]) {
  return entries.reduce((total, entry) => total + Number(entry.amount || 0), 0);
}

export function availableDistributionCredit(creditLimit: number, balance: number) {
  return Math.max(0, Number(creditLimit || 0) - Number(balance || 0));
}

export function canCreateDistributionCharge(input: {
  creditLimit: number;
  balance: number;
  wholesalePrice: number;
}) {
  return (
    Number.isFinite(input.wholesalePrice) &&
    input.wholesalePrice >= 0 &&
    input.balance + input.wholesalePrice <= input.creditLimit
  );
}
