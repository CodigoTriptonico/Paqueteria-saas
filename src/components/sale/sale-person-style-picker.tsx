"use client";

import { SurfacePalettePicker } from "@/components/ui/surface-palette-picker";
import type { SalePersonCardVariantId } from "@/components/sale/sale-person-card-variants";
import { resolveUiSurfacePalette } from "@/lib/ui-surface-palettes";

type SalePersonStylePickerProps = {
  x: number;
  y: number;
  currentStyle: SalePersonCardVariantId;
  onSelect: (styleId: SalePersonCardVariantId) => void;
  onClose: () => void;
};

function paletteIdForPersonCardStyle(styleId: SalePersonCardVariantId) {
  const match = resolveUiSurfacePalette(styleId);
  if (match.personCardId === styleId) {
    return match.id;
  }
  return styleId;
}

export function SalePersonStylePicker({
  x,
  y,
  currentStyle,
  onSelect,
  onClose,
}: SalePersonStylePickerProps) {
  return (
    <SurfacePalettePicker
      mode="personCard"
      x={x}
      y={y}
      currentId={paletteIdForPersonCardStyle(currentStyle)}
      title="Color de tarjeta"
      onSelect={(paletteId) => {
        const palette = resolveUiSurfacePalette(paletteId);
        onSelect((palette.personCardId ?? paletteId) as SalePersonCardVariantId);
      }}
      onClose={onClose}
    />
  );
}
