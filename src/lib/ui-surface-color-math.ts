/** Utilidades determinísticas para colores de superficie (sin LLM). */

const HEX_RE = /^#([0-9a-f]{6})$/i;

export function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!HEX_RE.test(withHash)) {
    return null;
  }
  return withHash.toLowerCase();
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    return null;
  }
  const raw = normalized.slice(1);
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  const clamp = (channel: number) => Math.max(0, Math.min(255, Math.round(channel)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Mezcla hacia blanco (amount 0–1) o negro (amount negativo). */
function mixHex(hex: string, amount: number, target: "white" | "black" = "white") {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return null;
  }
  const targetRgb = target === "white" ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  const t = Math.max(-1, Math.min(1, amount));
  const weight = t >= 0 ? t : -t;
  const from = t >= 0 ? rgb : targetRgb;
  const to = t >= 0 ? targetRgb : rgb;
  return rgbToHex(
    from.r + (to.r - from.r) * weight,
    from.g + (to.g - from.g) * weight,
    from.b + (to.b - from.b) * weight,
  );
}

/** Hover por defecto: un poco más claro en fondos oscuros. */
export function defaultHoverHex(baseHex: string) {
  const rgb = hexToRgb(baseHex);
  if (!rgb) {
    return "#343d4d";
  }
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return mixHex(baseHex, luminance < 0.35 ? 0.14 : 0.08, "white") ?? baseHex;
}

export function colorDistance(hexA: string, hexB: string) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

export function randomCustomPaletteId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `custom:${crypto.randomUUID()}`;
  }
  return `custom:${Date.now().toString(36)}`;
}
