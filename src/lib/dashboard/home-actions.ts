export const HOME_ACTION_HREFS = {
  newSale: "/venta",
  logistics: "/logistica",
  inventory: "/inventario",
} as const;

export type HomeActionId = keyof typeof HOME_ACTION_HREFS;
