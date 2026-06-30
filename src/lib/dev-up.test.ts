import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  envUrlMatchesApiPort,
  isPortWindowsExcluded,
  parseEnvSupabaseUrl,
  parseSupabasePortsFromConfig,
} from "../../scripts/lib/dev-up.mjs";

describe("parseSupabasePortsFromConfig", () => {
  it("reads api and db ports from config.toml sections", () => {
    const toml = `
[api]
port = 54321

[db]
port = 54322
shadow_port = 54320
`;
    assert.deepEqual(parseSupabasePortsFromConfig(toml), {
      apiPort: 54321,
      dbPort: 54322,
    });
  });
});

describe("parseEnvSupabaseUrl", () => {
  it("extracts NEXT_PUBLIC_SUPABASE_URL", () => {
    assert.equal(
      parseEnvSupabaseUrl("NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\n"),
      "http://127.0.0.1:54321",
    );
  });
});

describe("envUrlMatchesApiPort", () => {
  it("matches when env port equals config api port", () => {
    assert.equal(envUrlMatchesApiPort("http://127.0.0.1:54321", 54321), true);
    assert.equal(envUrlMatchesApiPort("http://127.0.0.1:58021", 54321), false);
    assert.equal(envUrlMatchesApiPort(null, 54321), false);
  });
});

describe("isPortWindowsExcluded", () => {
  it("detects ports inside Hyper-V exclusion ranges", () => {
    const sample = `
Start Port    End Port
     57969       58068
     58069       58168
`;
    assert.equal(isPortWindowsExcluded(58022, sample), true);
    assert.equal(isPortWindowsExcluded(54321, sample), false);
  });
});
