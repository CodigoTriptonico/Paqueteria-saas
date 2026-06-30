import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasNativePicker, openNativePicker } from "./native-picker";

describe("native picker", () => {
  it("detects native picker support", () => {
    assert.equal(hasNativePicker({ showPicker() {} }), true);
    assert.equal(hasNativePicker({}), false);
    assert.equal(hasNativePicker(null), false);
  });

  it("opens the browser picker when showPicker is available", () => {
    let calls = 0;

    const opened = openNativePicker({
      showPicker() {
        calls += 1;
      },
    });

    assert.equal(opened, true);
    assert.equal(calls, 1);
  });

  it("does not crash when the picker is missing or blocked", () => {
    assert.equal(openNativePicker(null), false);
    assert.equal(openNativePicker({}), false);
    assert.equal(
      openNativePicker({
        showPicker() {
          throw new Error("blocked");
        },
      }),
      false,
    );
  });
});
