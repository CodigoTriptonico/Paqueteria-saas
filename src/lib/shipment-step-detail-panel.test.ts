import assert from "node:assert/strict";
import test from "node:test";
import {
  shipmentStepDetailPanelArrowLeft,
  shipmentStepDetailPanelConnector,
  shipmentStepDetailPanelPosition,
} from "@/lib/shipment-step-detail-panel";

test("shipmentStepDetailPanelPosition anchors below the progress card header", () => {
  const anchor = { left: 24, top: 120, width: 320, height: 96 };
  const position = shipmentStepDetailPanelPosition(anchor, 900);

  assert.equal(position.left, 24);
  assert.equal(position.top, 188);
  assert.equal(position.width, 320);
  assert.equal(position.maxHeight, 700);
  assert.equal(position.placement, "below");
});

test("shipmentStepDetailPanelPosition opens above when there is more room", () => {
  const anchor = { left: 12, top: 760, width: 280, height: 88 };
  const position = shipmentStepDetailPanelPosition(anchor, 820);

  assert.equal(position.placement, "above");
  assert.ok(position.top < anchor.top);
  assert.ok(position.maxHeight >= 180);
});

test("shipmentStepDetailPanelArrowLeft clamps to panel edges", () => {
  assert.equal(shipmentStepDetailPanelArrowLeft(100, 200, 150), 150);
  assert.equal(shipmentStepDetailPanelArrowLeft(100, 200, 90), 108);
  assert.equal(shipmentStepDetailPanelArrowLeft(100, 200, 320), 292);
});

test("shipmentStepDetailPanelConnector links step button to panel below", () => {
  const step = { left: 40, top: 140, width: 24, height: 24 };
  const panel = { left: 24, top: 188, width: 320, maxHeight: 400, placement: "below" as const };
  const connector = shipmentStepDetailPanelConnector(step, panel);

  assert.equal(connector.stepCenterX, 52);
  assert.equal(connector.connectorTop, 164);
  assert.equal(connector.connectorHeight, 24);
  assert.equal(connector.caretOnPanelTop, true);
  assert.equal(connector.arrowLeft, 52);
});
