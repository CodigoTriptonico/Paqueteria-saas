const SHIPMENT_STEP_DETAIL_PANEL_TOP_OFFSET_PX = 68;
const SHIPMENT_STEP_DETAIL_PANEL_GAP_PX = 12;
const SHIPMENT_STEP_DETAIL_PANEL_ARROW_HALF_WIDTH_PX = 8;

export type ShipmentStepDetailPanelAnchor = {
  left: number;
  top: number;
  width: number;
  height?: number;
};

export type ShipmentStepDetailPanelPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: "below" | "above";
};

export function shipmentStepDetailPanelPosition(
  anchor: ShipmentStepDetailPanelAnchor,
  viewportHeight: number,
): ShipmentStepDetailPanelPosition {
  const belowTop = anchor.top + SHIPMENT_STEP_DETAIL_PANEL_TOP_OFFSET_PX;
  const spaceBelow = viewportHeight - belowTop - SHIPMENT_STEP_DETAIL_PANEL_GAP_PX;
  const aboveTop = Math.max(
    SHIPMENT_STEP_DETAIL_PANEL_GAP_PX,
    anchor.top - SHIPMENT_STEP_DETAIL_PANEL_GAP_PX,
  );
  const spaceAbove = aboveTop - SHIPMENT_STEP_DETAIL_PANEL_GAP_PX;

  const openBelow = spaceBelow >= spaceAbove;
  const maxHeight = Math.max(
    180,
    Math.min(openBelow ? spaceBelow : spaceAbove, viewportHeight - SHIPMENT_STEP_DETAIL_PANEL_GAP_PX * 2),
  );
  const top = openBelow
    ? belowTop
    : Math.max(SHIPMENT_STEP_DETAIL_PANEL_GAP_PX, anchor.top - maxHeight - SHIPMENT_STEP_DETAIL_PANEL_GAP_PX);

  return {
    left: anchor.left,
    top,
    width: Math.max(anchor.width, 280),
    maxHeight,
    placement: openBelow ? ("below" as const) : ("above" as const),
  };
}

export function shipmentStepDetailPanelArrowLeft(
  panelLeft: number,
  panelWidth: number,
  stepCenterX: number,
  arrowHalfWidth = SHIPMENT_STEP_DETAIL_PANEL_ARROW_HALF_WIDTH_PX,
) {
  const min = panelLeft + arrowHalfWidth;
  const max = panelLeft + panelWidth - arrowHalfWidth;
  return Math.min(max, Math.max(min, stepCenterX));
}

export function shipmentStepDetailPanelConnector(
  stepAnchor: ShipmentStepDetailPanelAnchor,
  panelPosition: ShipmentStepDetailPanelPosition,
) {
  const stepCenterX = stepAnchor.left + stepAnchor.width / 2;
  const stepBottom = stepAnchor.top + (stepAnchor.height ?? 0);
  const arrowLeft = shipmentStepDetailPanelArrowLeft(
    panelPosition.left,
    panelPosition.width,
    stepCenterX,
  );

  if (panelPosition.placement === "below") {
    return {
      arrowLeft,
      stepCenterX,
      connectorTop: stepBottom,
      connectorHeight: Math.max(0, panelPosition.top - stepBottom),
      caretOnPanelTop: true,
    };
  }

  const panelBottom = panelPosition.top + panelPosition.maxHeight;

  return {
    arrowLeft,
    stepCenterX,
    connectorTop: panelBottom,
    connectorHeight: Math.max(0, stepAnchor.top - panelBottom),
    caretOnPanelTop: false,
  };
}
