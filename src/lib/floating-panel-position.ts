export type FloatingPanelAlign = "left" | "right";

type RectLike = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export function resolveFloatingPanelPosition({
  trigger,
  panelWidth,
  panelHeight,
  viewportWidth,
  viewportHeight,
  align,
  gap = 8,
  margin = 12,
}: {
  trigger: RectLike;
  panelWidth: number;
  panelHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  align: FloatingPanelAlign;
  gap?: number;
  margin?: number;
}) {
  const width = Math.min(panelWidth, Math.max(0, viewportWidth - margin * 2));
  const maxHeight = Math.max(120, viewportHeight - margin * 2);
  const height = Math.min(panelHeight, maxHeight);
  const roomBelow = viewportHeight - trigger.bottom - margin;
  const roomAbove = trigger.top - margin;
  const placeBelow = roomBelow >= height + gap || roomBelow >= roomAbove;
  const top = placeBelow
    ? Math.min(trigger.bottom + gap, viewportHeight - height - margin)
    : Math.max(margin, trigger.top - gap - height);
  const preferredLeft = align === "right" ? trigger.right - width : trigger.left;
  const left = Math.min(
    Math.max(margin, preferredLeft),
    Math.max(margin, viewportWidth - width - margin),
  );

  return { top, left, width, maxHeight };
}
