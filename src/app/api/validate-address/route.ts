import { resolveGoogleCountryCode } from "@/lib/country-options";
import { filterGoogleAddressSuggestions } from "@/lib/google-address-suggestions";
import { getAppSession } from "@/lib/auth/session";
import {
  enforceValidateAddressRateLimit,
  isRateLimitError,
  VALIDATE_ADDRESS_MAX_BODY_BYTES,
  VALIDATE_ADDRESS_MAX_QUERY_LENGTH,
} from "@/lib/security/api-guards";

type AddressInput = {
  mode?: "validate" | "suggest" | "details";
  query?: string;
  placeId?: string;
  street?: string;
  houseNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GoogleGeocodeResult = {
  address_components: GoogleAddressComponent[];
  formatted_address: string;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
  partial_match?: boolean;
  place_id: string;
  types: string[];
};

type GooglePlacePrediction = {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

const GENERIC_ADDRESS_ERROR = "No se pudo validar la direccion";

function firstComponent(components: GoogleAddressComponent[], types: string[]) {
  return components.find((component) =>
    types.some((type) => component.types.includes(type)),
  );
}

function normalizeAddress(result: GoogleGeocodeResult) {
  const components = result.address_components;
  const lat = result.geometry?.location?.lat;
  const lng = result.geometry?.location?.lng;
  const streetNumber = firstComponent(components, ["street_number"])?.long_name || "";
  const route = firstComponent(components, ["route"])?.long_name || "";
  const subpremise = firstComponent(components, ["subpremise"])?.long_name || "";
  const premise = firstComponent(components, ["premise"])?.long_name || "";
  const neighborhood =
    firstComponent(components, ["neighborhood", "sublocality", "sublocality_level_1"])?.long_name || "";
  const city =
    firstComponent(components, ["locality", "postal_town", "administrative_area_level_2"])?.long_name || "";
  const state = firstComponent(components, ["administrative_area_level_1"])?.short_name || "";
  const postalCode = firstComponent(components, ["postal_code"])?.long_name || "";
  const country = firstComponent(components, ["country"])?.long_name || "";
  const streetLine = [streetNumber, route].filter(Boolean).join(" ");
  const unit = [subpremise, premise].filter(Boolean).join(" ");

  return {
    street: streetLine || route,
    houseNumber: unit,
    neighborhood,
    city,
    state,
    postalCode,
    country,
    formattedAddress: result.formatted_address,
    placeId: result.place_id,
    lat: typeof lat === "number" && Number.isFinite(lat) ? lat : null,
    lng: typeof lng === "number" && Number.isFinite(lng) ? lng : null,
  };
}

async function getPlacePostalCode(placeId: string, apiKey: string) {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: "address_components",
    key: apiKey,
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`,
    { cache: "no-store" },
  );
  const data = (await response.json()) as {
    status: string;
    result?: Pick<GoogleGeocodeResult, "address_components">;
  };

  if (!response.ok || data.status !== "OK" || !data.result) {
    return "";
  }

  return firstComponent(data.result.address_components, ["postal_code"])?.long_name || "";
}

export async function POST(request: Request) {
  try {
    const session = await getAppSession();
    if (!session) {
      return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const rawBody = await request.text();
    if (rawBody.length > VALIDATE_ADDRESS_MAX_BODY_BYTES) {
      return Response.json(
        { ok: false, error: "Solicitud demasiado grande" },
        { status: 413 },
      );
    }

    try {
      await enforceValidateAddressRateLimit(request.headers, session.userId);
    } catch (error) {
      if (isRateLimitError(error)) {
        return Response.json({ ok: false, error: error.message }, { status: 429 });
      }
      console.error("[validate-address] rate limit error", error);
      return Response.json({ ok: false, error: GENERIC_ADDRESS_ERROR }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.error("[validate-address] missing GOOGLE_MAPS_API_KEY");
      return Response.json(
        { ok: false, error: "Servicio no disponible" },
        { status: 500 },
      );
    }

    const body = JSON.parse(rawBody || "{}") as AddressInput;
    const countryCode = resolveGoogleCountryCode(body.country);

    if (body.mode === "suggest") {
      const query = body.query?.trim();

      if (!query || query.length < 3) {
        return Response.json({ ok: true, suggestions: [] });
      }

      if (query.length > VALIDATE_ADDRESS_MAX_QUERY_LENGTH) {
        return Response.json(
          { ok: false, error: "Consulta demasiado larga" },
          { status: 400 },
        );
      }

      const params = new URLSearchParams({
        input: query,
        key: apiKey,
        types: "address",
      });

      if (countryCode) {
        params.set("components", `country:${countryCode}`);
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as {
        status: string;
        error_message?: string;
        predictions?: GooglePlacePrediction[];
      };

      if (!response.ok || (data.status !== "OK" && data.status !== "ZERO_RESULTS")) {
        if (data.error_message || data.status) {
          console.error("[validate-address] google suggest failed", {
            status: data.status,
            message: data.error_message,
          });
        }
        return Response.json({
          ok: false,
          error: GENERIC_ADDRESS_ERROR,
        });
      }

      const suggestions = filterGoogleAddressSuggestions(
        await Promise.all(
          (data.predictions || []).slice(0, 5).map(async (prediction) => ({
            placeId: prediction.place_id,
            description: prediction.description,
            mainText: prediction.structured_formatting?.main_text || prediction.description,
            secondaryText: prediction.structured_formatting?.secondary_text || "",
            postalCode: await getPlacePostalCode(prediction.place_id, apiKey),
          })),
        ),
        query,
      );

      return Response.json({
        ok: true,
        suggestions,
      });
    }

    if (body.mode === "details") {
      if (!body.placeId) {
        return Response.json(
          { ok: false, error: "Falta placeId" },
          { status: 400 },
        );
      }

      const params = new URLSearchParams({
        place_id: body.placeId,
        fields: "address_components,formatted_address,geometry,place_id,types",
        key: apiKey,
      });
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as {
        status: string;
        error_message?: string;
        result?: GoogleGeocodeResult;
      };

      if (!response.ok || data.status !== "OK" || !data.result) {
        if (data.error_message || data.status) {
          console.error("[validate-address] google details failed", {
            status: data.status,
            message: data.error_message,
          });
        }
        return Response.json({
          ok: false,
          error: GENERIC_ADDRESS_ERROR,
        });
      }

      const normalized = normalizeAddress(data.result);

      return Response.json({
        ok: Boolean(normalized.street && normalized.city && normalized.country),
        address: normalized,
        error: normalized.street ? "" : "Faltan partes de direccion",
      });
    }

    const address = [
      body.houseNumber,
      body.street,
      body.neighborhood,
      body.city,
      body.state,
      body.postalCode,
      body.country,
    ]
      .filter(Boolean)
      .join(", ");

    if (!address.trim()) {
      return Response.json(
        { ok: false, error: "Direccion vacia" },
        { status: 400 },
      );
    }

    const params = new URLSearchParams({
      address,
      key: apiKey,
    });

    if (countryCode) {
      params.set("components", `country:${countryCode}`);
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
      { cache: "no-store" },
    );
    const data = (await response.json()) as {
      status: string;
      error_message?: string;
      results?: GoogleGeocodeResult[];
    };
    const result = data.results?.[0];

    if (!response.ok || data.status !== "OK" || !result) {
      if (data.error_message || data.status) {
        console.error("[validate-address] google geocode failed", {
          status: data.status,
          message: data.error_message,
        });
      }
      return Response.json({
        ok: false,
        error: GENERIC_ADDRESS_ERROR,
      });
    }

    const normalized = normalizeAddress(result);
    const hasMinimumParts = Boolean(normalized.street && normalized.city && normalized.country);

    return Response.json({
      ok: hasMinimumParts && !result.partial_match,
      partial: Boolean(result.partial_match),
      address: normalized,
      error: hasMinimumParts ? "" : "Faltan partes de direccion",
    });
  } catch (error) {
    console.error("[validate-address] request failed", error);
    return Response.json(
      { ok: false, error: "Solicitud invalida o error del servidor" },
      { status: 400 },
    );
  }
}
