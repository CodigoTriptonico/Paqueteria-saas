"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";

type SelectableItem = {
  id: string;
};

export function useEnviosShipmentSelection<T extends SelectableItem>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const anchorIndexRef = useRef<number | null>(null);

  useEffect(() => {
    const visibleIds = new Set(items.map((item) => item.id));

    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setSelectedIds((current) => {
        const next = new Set([...current].filter((id) => visibleIds.has(id)));
        return next.size === current.size ? current : next;
      });
    });
    return () => {
      active = false;
    };
  }, [items]);

  const handleRowSelectClick = useCallback(
    (event: MouseEvent, index: number, id: string) => {
      const multiKey = event.ctrlKey || event.metaKey;
      const rangeKey = event.shiftKey;

      if (!multiKey && !rangeKey) {
        return false;
      }

      event.preventDefault();
      event.stopPropagation();

      setSelectedIds((current) => {
        const next = new Set(current);

        if (rangeKey && anchorIndexRef.current !== null) {
          const start = Math.min(anchorIndexRef.current, index);
          const end = Math.max(anchorIndexRef.current, index);

          for (let cursor = start; cursor <= end; cursor += 1) {
            next.add(items[cursor]!.id);
          }
        } else if (multiKey) {
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        } else {
          next.add(id);
        }

        return next;
      });

      if (!rangeKey || anchorIndexRef.current === null) {
        anchorIndexRef.current = index;
      }

      return true;
    },
    [items],
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((item) => item.id)));
    anchorIndexRef.current = 0;
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    anchorIndexRef.current = null;
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    handleRowSelectClick,
    selectAll,
    clearSelection,
    isSelected,
  };
}
