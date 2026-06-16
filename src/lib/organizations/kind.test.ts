import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canDeactivateOrganization,
  isClientOrganization,
  resolvePostLoginRedirect,
} from "./kind";

describe("organization kind", () => {
  it("lista solo clientes en /platform", () => {
    assert.equal(isClientOrganization("client"), true);
    assert.equal(isClientOrganization("platform"), false);
    assert.equal(isClientOrganization(undefined), true);
  });

  it("no desactiva org platform", () => {
    assert.equal(canDeactivateOrganization("platform"), false);
    assert.equal(canDeactivateOrganization("client"), true);
  });

  it("dueno va a /platform tras login sin next", () => {
    assert.equal(resolvePostLoginRedirect({ isPlatformAdmin: true }), "/platform");
    assert.equal(
      resolvePostLoginRedirect({ isPlatformAdmin: true, nextPath: "/" }),
      "/platform",
    );
  });

  it("dueno solo respeta next de plataforma", () => {
    assert.equal(
      resolvePostLoginRedirect({ isPlatformAdmin: true, nextPath: "/configuracion" }),
      "/platform",
    );
    assert.equal(
      resolvePostLoginRedirect({ isPlatformAdmin: true, nextPath: "/platform" }),
      "/platform",
    );
  });

  it("cliente va a inicio operativo", () => {
    assert.equal(resolvePostLoginRedirect({ isPlatformAdmin: false }), "/");
    assert.equal(
      resolvePostLoginRedirect({ isPlatformAdmin: false, nextPath: "/venta" }),
      "/venta",
    );
  });
});
