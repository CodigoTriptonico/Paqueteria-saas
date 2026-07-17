export const HOME_ACTION_HREFS = {
  newSale: "/venta",
  pickups: "/logistica",
  tracking: "/seguimiento",
} as const;

export type HomeActionId = keyof typeof HOME_ACTION_HREFS;
