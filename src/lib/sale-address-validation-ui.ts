import type { AddressValidation } from "@/components/sale/venta-parts";

export type AddressValidationTone =
  | "disabled"
  | "idle"
  | "searching"
  | "checking"
  | "suggestions"
  | "valid"
  | "invalid"
  | "unverified";

export type AddressValidationUi = {
  tone: AddressValidationTone;
  title: string;
  message: string;
  showStatusPanel: boolean;
  showSuggestions: boolean;
  suggestionsTitle: string;
  showUnverifiedButton: boolean;
  showPreview: boolean;
  previewLabel: string;
  previewTone: "muted" | "valid" | "invalid" | "unverified" | "disabled";
  previewText: string;
};

type ResolveAddressValidationUiInput = {
  enabled: boolean;
  disabledMessage?: string;
  searching?: boolean;
  validation: AddressValidation;
  suggestionsCount: number;
  unverifiedAccepted: boolean;
  hasRequiredAddress: boolean;
  fullAddress: string;
};

export function resolveAddressValidationUi({
  enabled,
  disabledMessage = "Elige el pais del destinatario para habilitar la direccion.",
  searching = false,
  validation,
  suggestionsCount,
  unverifiedAccepted,
  hasRequiredAddress,
  fullAddress,
}: ResolveAddressValidationUiInput): AddressValidationUi {
  const previewFromValidation =
    validation.formattedAddress || validation.message || fullAddress || "";

  if (!enabled) {
    return {
      tone: "disabled",
      title: "Direccion bloqueada",
      message: disabledMessage,
      showStatusPanel: true,
      showSuggestions: false,
      suggestionsTitle: "",
      showUnverifiedButton: false,
      showPreview: false,
      previewLabel: "",
      previewTone: "disabled",
      previewText: disabledMessage,
    };
  }

  if (unverifiedAccepted) {
    return {
      tone: "unverified",
      title: "Sin verificar",
      message: "Se guardara sin validacion de Google.",
      showStatusPanel: true,
      showSuggestions: false,
      suggestionsTitle: "",
      showUnverifiedButton: false,
      showPreview: Boolean(fullAddress),
      previewLabel: "Direccion escrita",
      previewTone: "muted",
      previewText: fullAddress || "Completa la direccion antes de guardar.",
    };
  }

  if (searching) {
    return {
      tone: "searching",
      title: "Buscando en Google",
      message: "Consultando coincidencias…",
      showStatusPanel: false,
      showSuggestions: false,
      suggestionsTitle: "",
      showUnverifiedButton: false,
      showPreview: Boolean(fullAddress),
      previewLabel: "Vista previa",
      previewTone: "muted",
      previewText: fullAddress,
    };
  }

  if (validation.status === "checking") {
    return {
      tone: "checking",
      title: "Verificando con Google",
      message: "Confirmando la direccion elegida…",
      showStatusPanel: false,
      showSuggestions: false,
      suggestionsTitle: "",
      showUnverifiedButton: false,
      showPreview: Boolean(fullAddress || validation.message),
      previewLabel: "Vista previa",
      previewTone: "muted",
      previewText: fullAddress || validation.message || "Validando direccion…",
    };
  }

  if (validation.status === "valid") {
    return {
      tone: "valid",
      title: "Verificada con Google",
      message: validation.message || "Lista para guardar.",
      showStatusPanel: true,
      showSuggestions: false,
      suggestionsTitle: "",
      showUnverifiedButton: false,
      showPreview: Boolean(previewFromValidation || fullAddress),
      previewLabel: "Direccion verificada",
      previewTone: "muted",
      previewText: previewFromValidation || fullAddress,
    };
  }

  if (validation.status === "invalid") {
    return {
      tone: "invalid",
      title: "No verificada",
      message: validation.message || "Google no pudo validar esta direccion.",
      showStatusPanel: true,
      showSuggestions: false,
      suggestionsTitle: "",
      showUnverifiedButton: hasRequiredAddress,
      showPreview: Boolean(fullAddress),
      previewLabel: "Vista previa",
      previewTone: "muted",
      previewText: fullAddress || validation.message || "Revisa los campos de la direccion.",
    };
  }

  if (suggestionsCount > 0) {
    const countLabel =
      suggestionsCount === 1 ? "1 coincidencia" : `${suggestionsCount} coincidencias`;

    return {
      tone: "suggestions",
      title: "Sugerencias de Google",
      message: "Selecciona la direccion correcta.",
      showStatusPanel: false,
      showSuggestions: true,
      suggestionsTitle: countLabel,
      showUnverifiedButton: hasRequiredAddress,
      showPreview: Boolean(fullAddress),
      previewLabel: "Vista previa",
      previewTone: "muted",
      previewText: fullAddress,
    };
  }

  return {
    tone: "idle",
    title: "Pendiente de verificar",
    message: hasRequiredAddress
      ? validation.message ||
        "Sin coincidencias en Google. Ajusta la direccion o usala sin verificar."
      : "Escribe calle, ciudad, estado y CP para buscar en Google.",
    showStatusPanel: false,
    showSuggestions: false,
    suggestionsTitle: "",
    showUnverifiedButton: hasRequiredAddress,
    showPreview: Boolean(fullAddress),
    previewLabel: hasRequiredAddress ? "Vista previa" : "",
    previewTone: "muted",
    previewText: fullAddress || "La direccion aparecera aqui mientras escribes.",
  };
}

export function addressCardSubtitle(tone: AddressValidationTone): string {
  switch (tone) {
    case "searching":
      return "Buscando en Google…";
    case "checking":
      return "Verificando…";
    case "suggestions":
      return "Elige una sugerencia";
    case "valid":
      return "Verificada";
    case "invalid":
      return "Revisar direccion";
    case "unverified":
      return "Sin verificar";
    case "disabled":
      return "Disponible al elegir pais";
    default:
      return "Buscar y validar en Google";
  }
}
