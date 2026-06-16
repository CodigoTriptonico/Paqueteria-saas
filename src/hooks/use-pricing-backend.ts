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
import { isSupabaseConfigured } from "@/lib/supabase/env";

const emptyRouteConfig: PricingRouteConfig = {
  deliveryDays: [],
  pickupDays: [],
  deliveryRanges: [],
  pickupRanges: [],
  pendingAllowed: true,
  routeLeadTime: "",
};

export function usePricingBackend() {
  const enabled = isSupabaseConfigured();
  const [countries, setCountries] = useState<PricingCountryConfig[]>([]);
  const [distributors, setDistributors] = useState<PricingDistributorConfig[]>([]);
  const [distributorPrices, setDistributorPrices] = useState<PricingDistributorPrices>({});
  const [routeConfig, setRouteConfig] = useState<PricingRouteConfig>(emptyRouteConfig);
  const [loaded, setLoaded] = useState(!enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lastSavedSnapshotRef = useRef("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function snapshotPayload(payload: PricingConfigPayload) {
    return JSON.stringify(payload);
  }

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

    const payload = {
      countries: result.data.countries,
      distributors: result.data.distributors,
      distributorPrices: result.data.distributorPrices,
      routeConfig: result.data.routeConfig,
    };

    lastSavedSnapshotRef.current = snapshotPayload(payload);
    setCountries(result.data.countries);
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
    async (payload: PricingConfigPayload) => {
      if (!enabled) {
        return;
      }

      setSaving(true);
      const result = await savePricingConfigAction(payload);
      setSaving(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      lastSavedSnapshotRef.current = snapshotPayload(payload);
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled || !loaded) {
      return;
    }

    const payload = {
      countries,
      distributors,
      distributorPrices,
      routeConfig,
    };
    const snapshot = snapshotPayload(payload);

    if (snapshot === lastSavedSnapshotRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void persist(payload);
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
    distributors,
    setDistributors,
    distributorPrices,
    setDistributorPrices,
    routeConfig,
    setRouteConfig,
    reload: loadRemote,
  };
}
