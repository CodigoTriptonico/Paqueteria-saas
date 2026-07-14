import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hasNativePicker,
  isNativeDateTimeInput,
  openNativePicker,
  shouldSuppressDismissForNativePicker,
} from "./native-picker";

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

  it("detects native date and time inputs", () => {
    assert.equal(
      isNativeDateTimeInput({ tagName: "INPUT", type: "time" } as HTMLInputElement),
      true,
    );
    assert.equal(
      isNativeDateTimeInput({ tagName: "INPUT", type: "date" } as HTMLInputElement),
      true,
    );
    assert.equal(
      isNativeDateTimeInput({ tagName: "INPUT", type: "text" } as HTMLInputElement),
      false,
    );
    assert.equal(isNativeDateTimeInput(null), false);
  });

  it("suppresses dismiss while a native picker input stays focused outside the container", () => {
    const inside = { nodeType: 1, id: "inside" } as unknown as Node;
    const outside = { nodeType: 1, id: "outside" } as unknown as Node;
    const container = {
      contains(node: Node) {
        return node === inside;
      },
    };

    const timeInput = { tagName: "INPUT", type: "time" } as HTMLInputElement;

    assert.equal(
      shouldSuppressDismissForNativePicker({ target: outside }, container, timeInput),
      true,
    );
    assert.equal(
      shouldSuppressDismissForNativePicker({ target: inside }, container, timeInput),
      false,
    );
    assert.equal(
      shouldSuppressDismissForNativePicker({ target: outside }, container, null),
      false,
    );
    assert.equal(
      shouldSuppressDismissForNativePicker(
        { target: outside },
        container,
        { tagName: "INPUT", type: "text" } as HTMLInputElement,
      ),
      false,
    );
  });

  it("suppresses dismiss while interacting with the custom date picker panel", () => {
    const panelChild = {
      nodeType: 1,
      closest(selector: string) {
        return selector.includes("data-time-picker-panel") ? panel : null;
      },
    } as unknown as Node;
    const panel = { nodeType: 1 } as unknown as Element;
    const outside = { nodeType: 1, id: "outside" } as unknown as Node;
    const container = {
      contains() {
        return false;
      },
    };

    assert.equal(
      shouldSuppressDismissForNativePicker({ target: panelChild }, container, null),
      true,
    );
    assert.equal(
      shouldSuppressDismissForNativePicker({ target: outside }, container, null),
      false,
    );
  });
});
