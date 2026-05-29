export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T>(error: string): ActionResult<T> {
  return { ok: false, error };
}

export function actionErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return "Sesion requerida";
    }
    if (error.message === "FORBIDDEN") {
      return "No tienes permiso para esta accion";
    }
    return error.message;
  }

  return "Error inesperado";
}
