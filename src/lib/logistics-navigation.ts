export function buildMapsNavigationUrl(input: {
  lat: number | null;
  lng: number | null;
  label?: string | null;
}) {
  if (input.lat == null || input.lng == null || !Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    return null;
  }

  const label = encodeURIComponent((input.label || "").trim());
  const coords = `${input.lat},${input.lng}`;

  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${coords}${label ? `&destination_place_id=${label}` : ""}`,
    apple: `maps://?daddr=${coords}${label ? `&q=${label}` : ""}`,
  };
}
