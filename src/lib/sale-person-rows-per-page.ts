export const DEFAULT_SALE_PERSON_ROW_HEIGHT_PX = 50;
export const SALE_PERSON_LIST_SECTION_GAP_PX = 12;

export function salePersonRowsThatFit(
  containerHeight: number,
  rowHeight = DEFAULT_SALE_PERSON_ROW_HEIGHT_PX,
) {
  if (containerHeight < rowHeight) {
    return 1;
  }

  return Math.max(1, Math.floor(containerHeight / rowHeight));
}

export function resolveSalePersonPageSize(rowsThatFit: number, itemCount: number) {
  if (itemCount <= 0) {
    return rowsThatFit;
  }

  return itemCount <= rowsThatFit ? itemCount : rowsThatFit;
}

export function salePersonListChromeHeight(
  section: HTMLElement,
  listSlot: HTMLElement,
  sectionGapPx = SALE_PERSON_LIST_SECTION_GAP_PX,
) {
  let chrome = 0;

  for (const child of Array.from(section.children)) {
    if (child === listSlot) {
      continue;
    }

    chrome += (child as HTMLElement).offsetHeight;
  }

  const gapCount = Math.max(0, section.children.length - 1);
  return chrome + gapCount * sectionGapPx;
}

export function salePersonListAvailableHeight(
  section: HTMLElement,
  listSlot: HTMLElement,
  sectionGapPx = SALE_PERSON_LIST_SECTION_GAP_PX,
) {
  return Math.max(
    0,
    section.clientHeight - salePersonListChromeHeight(section, listSlot, sectionGapPx),
  );
}
