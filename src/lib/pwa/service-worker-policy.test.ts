import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  shouldRegisterServiceWorker,
  shouldReloadAfterDevelopmentCleanup,
} from "./service-worker-policy";

describe("service worker policy", () => {
  it("registers only production PWA sessions on supported origins", () => {
    assert.equal(
      shouldRegisterServiceWorker({
        nodeEnv: "production",
        protocol: "https:",
        hostname: "boxario.example",
      }),
      true,
    );
    assert.equal(
      shouldRegisterServiceWorker({
        nodeEnv: "production",
        protocol: "http:",
        hostname: "localhost",
      }),
      true,
    );
  });

  it("never registers the PWA worker during development", () => {
    assert.equal(
      shouldRegisterServiceWorker({
        nodeEnv: "development",
        protocol: "https:",
        hostname: "boxario.example",
      }),
      false,
    );
  });

  it("reloads only when an old app worker can still control the page", () => {
    assert.equal(
      shouldReloadAfterDevelopmentCleanup({ registrationCount: 1, hasController: false }),
      true,
    );
    assert.equal(
      shouldReloadAfterDevelopmentCleanup({ registrationCount: 0, hasController: true }),
      true,
    );
    assert.equal(
      shouldReloadAfterDevelopmentCleanup({ registrationCount: 0, hasController: false }),
      false,
    );
  });
});
