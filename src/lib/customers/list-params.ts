export const DEFAULT_CUSTOMER_LIST_LIMIT = 30;
export const MAX_CUSTOMER_LIST_LIMIT = 100;

export type ListCustomersParams = {
  query?: string;
  limit?: number;
  offset?: number;
};

export function normalizeCustomerListParams(params?: ListCustomersParams) {
  const limit = Math.min(
    Math.max(params?.limit ?? DEFAULT_CUSTOMER_LIST_LIMIT, 1),
    MAX_CUSTOMER_LIST_LIMIT,
  );
  const offset = Math.max(params?.offset ?? 0, 0);
  const query = params?.query?.trim() ?? "";

  return { limit, offset, query };
}

export function escapeIlikePattern(value: string) {
  return value.replace(/[%_,]/g, "\\$&");
}
