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

const countryCodes: Record<string, string> = {
  USA: "US",
  "United States": "US",
  Mexico: "MX",
  Guatemala: "GT",
  Colombia: "CO",
  Honduras: "HN",
};

function firstComponent(components: GoogleAddressComponent[], types: string[]) {
  return components.find((component) =>
    types.some((type) => component.types.includes(type)),
  );
}

function normalizeAddress(result: GoogleGeocodeResult) {
  const components = result.address_components;
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
  };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return Response.json(
        { ok: false, error: "Falta GOOGLE_MAPS_API_KEY en .env.local" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as AddressInput;
    const countryCode = body.country ? countryCodes[body.country] : undefined;

    if (body.mode === "suggest") {
      const query = body.query?.trim();

      if (!query || query.length < 3) {
        return Response.json({ ok: true, suggestions: [] });
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
        return Response.json({
          ok: false,
          error: data.error_message || "Google no pudo sugerir direcciones",
          googleStatus: data.status,
        });
      }

      return Response.json({
        ok: true,
        suggestions: (data.predictions || []).slice(0, 5).map((prediction) => ({
          placeId: prediction.place_id,
          description: prediction.description,
          mainText: prediction.structured_formatting?.main_text || prediction.description,
          secondaryText: prediction.structured_formatting?.secondary_text || "",
        })),
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
        fields: "address_components,formatted_address,place_id,types",
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
        return Response.json({
          ok: false,
          error: data.error_message || "Google no encontro detalle",
          googleStatus: data.status,
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
      return Response.json({
        ok: false,
        error: data.error_message || "Google no encontro direccion valida",
        googleStatus: data.status,
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
  } catch {
    return Response.json(
      { ok: false, error: "Solicitud invalida o error del servidor" },
      { status: 400 },
    );
  }
}
