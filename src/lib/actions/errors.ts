export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

const INTERNAL_ERROR_PATTERN =
  /\b(postgres|sqlstate|pgrst|relation|column|constraint|duplicate key|violates|invalid input syntax|syntax error|permission denied for|schema|function public\.|rpc)\b/i;

export function publicActionErrorMessage(error: string) {
  const message = String(error || "").trim();
  if (!message || message.length > 300 || INTERNAL_ERROR_PATTERN.test(message)) {
    return "No se pudo completar la operacion";
  }
  return message;
}

export function fail<T>(error: string): ActionResult<T> {
  return { ok: false, error: publicActionErrorMessage(error) };
}

export function actionErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return "Sesion requerida";
    }
    if (error.message === "FORBIDDEN") {
      return "No tienes permiso para esta accion";
    }
    return publicActionErrorMessage(error.message);
  }

  return "Error inesperado";
}
