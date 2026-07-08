"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_VIEW_LAYOUT,
  type ViewLayout,
  readViewLayout,
  toggleViewLayout,
  writeViewLayout,
} from "@/lib/view-layout";

export function useViewLayout() {
  const [layout, setLayout] = useState<ViewLayout>(DEFAULT_VIEW_LAYOUT);

  useEffect(() => {
    setLayout(readViewLayout());
  }, []);

  const setViewLayout = useCallback((next: ViewLayout) => {
    setLayout(next);
    writeViewLayout(next);
  }, []);

  const toggleViewLayoutMode = useCallback(() => {
    setLayout((current) => {
      const next = toggleViewLayout(current);
      writeViewLayout(next);
      return next;
    });
  }, []);

  return { layout, setViewLayout, toggleViewLayout: toggleViewLayoutMode };
}
