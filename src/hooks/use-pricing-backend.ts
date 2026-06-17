"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadPricingConfigAction,
  savePricingConfigAction,
  type PricingConfigPayload,
  type PricingCountryConfig,
  type PricingDistributorConfig,
  type PricingDistributorPrices,
  type PricingRouteConfig,
} from "@/app/actions/pricing";
import { compareCountriesByCatalogOrder } from "@/lib/country-options";
import type { InventoryCatalogProduct } from "@/lib/pricing-catalog";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const emptyRouteConfig: PricingRouteConfig = {
  deliveryDays: [],
  pickupDays: [],
  deliveryRanges: [],
  pickupRanges: [],
  pendingAllowed: true,
  routeLeadTime: "",
};

function snapshotPayload(payload: {
  countries: PricingCountryConfig[];
  distributors: PricingDistributorConfig[];
  distributorPrices: PricingDistributorPrices;
  routeConfig: PricingRouteConfig;
}) {
  return JSON.stringify(payload);
}

export function usePricingBackend() {
  const enabled = isSupabaseConfigured();
  const [countries, setCountries] = useState<PricingCountryConfig[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<InventoryCatalogProduct[]>([]);
  const [distributors, setDistributors] = useState<PricingDistributorConfig[]>([]);
  const [distributorPrices, setDistributorPrices] = useState<PricingDistributorPrices>({});
  const [routeConfig, setRouteConfig] = useState<PricingRouteConfig>(emptyRouteConfig);
  const [loaded, setLoaded] = useState(!enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lastSavedSnapshotRef = useRef("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadRemote = useCallback(async () => {
    if (!enabled) {
      setLoaded(true);
      return;
    }

    setError("");
    const result = await loadPricingConfigAction();

    if (!result.ok) {
      setError(result.error);
      setLoaded(true);
      return;
    }

    const sortedCountries = [...result.data.countries].sort(compareCountriesByCatalogOrder);
    const saveable = {
      countries: sortedCountries,
      distributors: result.data.distributors,
      distributorPrices: result.data.distributorPrices,
      routeConfig: result.data.routeConfig,
    };

    lastSavedSnapshotRef.current = snapshotPayload(saveable);
    setCountries(sortedCountries);
    setCatalogProducts(result.data.catalogProducts);
    setDistributors(result.data.distributors);
    setDistributorPrices(result.data.distributorPrices);
    setRouteConfig(result.data.routeConfig);
    setLoaded(true);
  }, [enabled]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadRemote();
    });
  }, [loadRemote]);

  const persist = useCallback(
    async (saveable: {
      countries: PricingCountryConfig[];
      distributors: PricingDistributorConfig[];
      distributorPrices: PricingDistributorPrices;
      routeConfig: PricingRouteConfig;
    }) => {
      if (!enabled) {
        return;
      }

      setSaving(true);
      const result = await savePricingConfigAction({
        ...saveable,
        catalogProducts,
      });
      setSaving(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      lastSavedSnapshotRef.current = snapshotPayload(saveable);
    },
    [catalogProducts, enabled],
  );

  useEffect(() => {
    if (!enabled || !loaded) {
      return;
    }

    const saveable = {
      countries,
      distributors,
      distributorPrices,
      routeConfig,
    };
    const currentSnapshot = snapshotPayload(saveable);

    if (currentSnapshot === lastSavedSnapshotRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void persist(saveable);
    }, 900);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [countries, distributors, distributorPrices, routeConfig, enabled, loaded, persist]);

  return {
    enabled,
    loaded,
    saving,
    error,
    countries,
    setCountries,
    catalogProducts,
    setCatalogProducts,
    distributors,
    setDistributors,
    distributorPrices,
    setDistributorPrices,
    routeConfig,
    setRouteConfig,
    reload: loadRemote,
  };
}
