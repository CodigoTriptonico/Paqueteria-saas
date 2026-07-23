import { submitConductorTaskResultAction } from "@/app/actions/conductor-tasks";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

const RETRYABLE_ERRORS = [
  "fetch failed",
  "timeout",
  "temporarily unavailable",
  "connection",
  "rate limit",
  "Sincronización en curso",
];
const MAX_MULTIPART_BYTES = 9 * 1024 * 1024;

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
  const correlationId = randomUUID();
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_MULTIPART_BYTES) {
      return Response.json(
        { ok: false, retryable: false, error: "Operacion demasiado grande", correlationId },
        { status: 413, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
      return Response.json(
        { ok: false, retryable: false, error: "Formato de operacion invalido", correlationId },
        { status: 415, headers: { "Cache-Control": "private, no-store" } },
      );
    }
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
    console.error("[conductor/task-results] request failed", {
      correlationId,
      error: error instanceof Error ? error.name : "unknown",
    });
    return Response.json(
      {
        ok: false,
        retryable: true,
        error: "No se pudo procesar la operacion",
        correlationId,
      },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
