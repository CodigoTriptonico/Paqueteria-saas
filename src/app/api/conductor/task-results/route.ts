import { submitConductorTaskResultAction } from "@/app/actions/conductor-tasks";

export const runtime = "nodejs";

const RETRYABLE_ERRORS = [
  "fetch failed",
  "timeout",
  "temporarily unavailable",
  "connection",
  "rate limit",
  "Sincronización en curso",
];

function responseStatus(error: string) {
  if (error === "Sesion requerida") return 401;
  if (error === "No tienes permiso para esta accion") return 403;
  if (
    error === "Falta tarea" ||
    error === "Foto requerida" ||
    error.startsWith("Foto maxima") ||
    error.startsWith("Foto debe") ||
    error.startsWith("Indica") ||
    error.startsWith("Selecciona")
  ) {
    return 422;
  }
  if (error === "Tarea cancelada") return 409;
  return 503;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await submitConductorTaskResultAction(formData);
    if (result.ok) {
      return Response.json(result, {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    const status = responseStatus(result.error);
    const retryable = status >= 500 || RETRYABLE_ERRORS.some((text) => result.error.includes(text));
    return Response.json(
      { ...result, retryable },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        retryable: true,
        error: error instanceof Error ? error.message : "No se pudo leer la operación",
      },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
