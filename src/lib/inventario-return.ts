const ALLOWED_RETURN_PATHS = new Set(["/configuracion", "/venta"]);

export function isAllowedInventarioReturnTo(returnTo: string) {
  const trimmed = returnTo.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return false;
  }

  try {
    const url = new URL(trimmed, "http://local");
    return ALLOWED_RETURN_PATHS.has(url.pathname);
  } catch {
    return false;
  }
}

export function inventarioHrefWithReturn(returnTo: string) {
  if (!isAllowedInventarioReturnTo(returnTo)) {
    return "/inventario";
  }

  return `/inventario?returnTo=${encodeURIComponent(returnTo)}`;
}

export function readInventarioReturnTo(searchParams: Pick<URLSearchParams, "get">) {
  const value = searchParams.get("returnTo")?.trim();

  if (!value || !isAllowedInventarioReturnTo(value)) {
    return null;
  }

  return value;
}

export function inventarioReturnActionLabel(returnTo: string) {
  try {
    const url = new URL(returnTo, "http://local");

    if (url.pathname === "/configuracion" && url.searchParams.get("view") === "prices") {
      const country = url.searchParams.get("country")?.trim();

      if (country) {
        return `Volver a precios de ${country}`;
      }

      return "Volver a Países y precios";
    }

    if (url.pathname === "/venta") {
      return "Volver a Nueva venta";
    }
  } catch {
    return "Continuar";
  }

  return "Continuar";
}
