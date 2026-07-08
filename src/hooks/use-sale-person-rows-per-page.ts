"use client";

import { type RefObject, useEffect, useState } from "react";
import {
  DEFAULT_SALE_PERSON_ROW_HEIGHT_PX,
  resolveSalePersonPageSize,
  salePersonListAvailableHeight,
  salePersonRowsThatFit,
} from "@/lib/sale-person-rows-per-page";

export { salePersonRowsThatFit } from "@/lib/sale-person-rows-per-page";

export function useSalePersonRowsPerPage(
  sectionRef: RefObject<HTMLElement | null>,
  listSlotRef: RefObject<HTMLElement | null>,
  listFrameRef: RefObject<HTMLElement | null>,
  itemCount: number,
) {
  const [rowsPerPage, setRowsPerPage] = useState(Math.max(itemCount, 1));

  useEffect(() => {
    const section = sectionRef.current;
    const listSlot = listSlotRef.current;
    const listFrame = listFrameRef.current;

    if (!section || !listSlot || !listFrame) {
      return;
    }

    const measure = () => {
      const currentSection = sectionRef.current;
      const currentListFrame = listFrameRef.current;

      if (!currentSection || !currentListFrame) {
        return;
      }

      const availableHeight = salePersonListAvailableHeight(currentSection, listSlotRef.current!);
      if (availableHeight < 1) {
        return;
      }

      const sampleRow = currentListFrame.querySelector("[data-sale-person-row]");
      const rowHeight =
        sampleRow instanceof HTMLElement
          ? sampleRow.getBoundingClientRect().height
          : DEFAULT_SALE_PERSON_ROW_HEIGHT_PX;
      const rowsThatFit = salePersonRowsThatFit(availableHeight, rowHeight);
      const nextRowsPerPage = resolveSalePersonPageSize(rowsThatFit, itemCount);

      setRowsPerPage((current) => (current === nextRowsPerPage ? current : nextRowsPerPage));
    };

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(measure);
    });

    observer.observe(section);

    const mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(measure);
    });
    mutationObserver.observe(listFrame, { childList: true, subtree: true });

    measure();

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [itemCount, listFrameRef, listSlotRef, sectionRef]);

  return rowsPerPage;
}
