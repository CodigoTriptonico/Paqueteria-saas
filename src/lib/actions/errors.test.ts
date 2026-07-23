import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fail, publicActionErrorMessage } from "@/lib/actions/errors";

describe("public action errors", () => {
  it("keeps stable business messages", () => {
    assert.equal(publicActionErrorMessage("Foto requerida"), "Foto requerida");
    assert.equal(fail("No tienes permiso para esta accion").error, "No tienes permiso para esta accion");
  });

  it("redacts database and PostgREST internals", () => {
    assert.equal(
      publicActionErrorMessage('duplicate key value violates unique constraint "profiles_email_key"'),
      "No se pudo completar la operacion",
    );
    assert.equal(
      publicActionErrorMessage("PGRST202 Could not find function public.secret_rpc"),
      "No se pudo completar la operacion",
    );
  });
});
