"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadPricingConfigAction,
  savePricingConfigAction,
  type PricingCountryConfig,
  type PricingDistributorConfig,
  type PricingDistributorPrices,
  type PricingRouteConfig,
} from "@/app/actions/pricing";
import { compareCountriesByCatalogOrder } from "@/lib/country-options";
import { dispatchOnboardingProgressChanged } from "@/lib/onboarding/refresh";
import { defaultInvoiceBillingConfig } from "@/lib/invoice-billing";
import type { PricingPromotionConfig } from "@/lib/pricing-promotions";
import type { InventoryCatalogProduct } from "@/lib/pricing-catalog";
import type { PricingConfigPayload } from "@/lib/pricing/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const emptyRouteConfig: PricingRouteConfig = {
  deliveryDays: [],
  pickupDays: [],
  deliveryRanges: [],
  pickupRanges: [],
  pendingAllowed: true,
  routeLeadTime: "",
  linkedRouteSchedules: false,
  emptyBoxDeliveryFee: defaultInvoiceBillingConfig.emptyBoxDeliveryFee,
  fullBoxPickupFee: defaultInvoiceBillingConfig.fullBoxPickupFee,
  minimumDeposit: defaultInvoiceBillingConfig.minimumDeposit,
  logisticsFeeMode: defaultInvoiceBillingConfig.logisticsFeeMode,
};

function snapshotPayload(payload: {
  countries: PricingCountryConfig[];
  promotions: PricingPromotionConfig[];
  distributors: PricingDistributorConfig[];
  distributorPrices: PricingDistributorPrices;
  routeConfig: PricingRouteConfig;
}) {
  return JSON.stringify(payload);
}

function emptySaveableState() {
  return {
    countries: [] as PricingCountryConfig[],
    promotions: [] as PricingPromotionConfig[],
    distributors: [] as PricingDistributorConfig[],
    distributorPrices: {} as PricingDistributorPrices,
    routeConfig: emptyRouteConfig,
  };
}

function pricingStateFromPayload(payload: PricingConfigPayload) {
  const sortedCountries = [...payload.countries].sort(compareCountriesByCatalogOrder);

  return {
    countries: sortedCountries,
    promotions: payload.promotions,
    distributors: payload.distributors,
    distributorPrices: payload.distributorPrices,
    routeConfig: payload.routeConfig,
    catalogProducts: payload.catalogProducts,
  };
}

export function usePricingBackend(initialData?: PricingConfigPayload) {
  const enabled = isSupabaseConfigured();
  const initialState = initialData ? pricingStateFromPayload(initialData) : null;
  const [countries, setCountries] = useState<PricingCountryConfig[]>(
    initialState?.countries ?? [],
  );
  const [promotions, setPromotions] = useState<PricingPromotionConfig[]>(
    initialState?.promotions ?? [],
  );
  const [catalogProducts, setCatalogProducts] = useState<InventoryCatalogProduct[]>(
    initialState?.catalogProducts ?? [],
  );
  const [distributors, setDistributors] = useState<PricingDistributorConfig[]>(
    initialState?.distributors ?? [],
  );
  const [distributorPrices, setDistributorPrices] = useState<PricingDistributorPrices>(
    initialState?.distributorPrices ?? {},
  );
  const [routeConfig, setRouteConfig] = useState<PricingRouteConfig>(
    initialState?.routeConfig ?? emptyRouteConfig,
  );
  const [loaded, setLoaded] = useState(!enabled || Boolean(initialData));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lastSavedSnapshotRef = useRef(
    snapshotPayload(
      initialState ?? {
        countries: [],
        promotions: [],
        distributors: [],
        distributorPrices: {},
        routeConfig: emptyRouteConfig,
      },
    ),
  );
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(loaded);
  const saveableRef = useRef(emptySaveableState());

  useEffect(() => {
    loadedRef.current = loaded;
    saveableRef.current = {
      countries,
      promotions,
      distributors,
      distributorPrices,
      routeConfig,
    };
  }, [countries, distributors, distributorPrices, loaded, promotions, routeConfig]);

  const loadRemote = useCallback(async () => {
    if (!enabled) {
      setLoaded(true);
      return;
    }

    setError("");
    const snapshotBeforeLoad = snapshotPayload(saveableRef.current);
    const result = await loadPricingConfigAction();

    if (!result.ok) {
      setError(result.error);
      setLoaded(true);
      return;
    }

    const sortedCountries = [...result.data.countries].sort(compareCountriesByCatalogOrder);
    const saveable = {
      countries: sortedCountries,
      promotions: result.data.promotions,
      distributors: result.data.distributors,
      distributorPrices: result.data.distributorPrices,
      routeConfig: result.data.routeConfig,
    };

    setCatalogProducts(result.data.catalogProducts);

    const localChangedDuringLoad =
      snapshotPayload(saveableRef.current) !== snapshotBeforeLoad;
    const pendingLocalChanges =
      loadedRef.current &&
      snapshotPayload(saveableRef.current) !== lastSavedSnapshotRef.current;

    if (pendingLocalChanges || localChangedDuringLoad) {
      setLoaded(true);
      return;
    }

    lastSavedSnapshotRef.current = snapshotPayload(saveable);
    setCountries(sortedCountries);
    setPromotions(result.data.promotions);
    setDistributors(result.data.distributors);
    setDistributorPrices(result.data.distributorPrices);
    setRouteConfig(result.data.routeConfig);
    setLoaded(true);
  }, [
    enabled,
    setCatalogProducts,
    setCountries,
    setDistributorPrices,
    setDistributors,
    setError,
    setLoaded,
    setPromotions,
    setRouteConfig,
  ]);

  useEffect(() => {
    if (!enabled || initialData) {
      return;
    }

    queueMicrotask(() => {
      void loadRemote();
    });
  }, [enabled, initialData, loadRemote]);

  const persist = useCallback(
    async (saveable: {
      countries: PricingCountryConfig[];
      promotions: PricingPromotionConfig[];
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
      dispatchOnboardingProgressChanged();
    },
    [catalogProducts, enabled, setError, setSaving],
  );
  const persistRef = useRef(persist);

  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);

  const flushPendingSaveNow = useCallback(async () => {
    if (!enabled || !loaded) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const saveable = saveableRef.current;
    const currentSnapshot = snapshotPayload(saveable);

    if (currentSnapshot === lastSavedSnapshotRef.current) {
      return;
    }

    await persistRef.current(saveable);
  }, [enabled, loaded]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function flushOnPageHide() {
      flushPendingSaveNow();
    }

    window.addEventListener("pagehide", flushOnPageHide);

    return () => {
      window.removeEventListener("pagehide", flushOnPageHide);
    };
  }, [enabled, flushPendingSaveNow]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      if (!enabled || !loadedRef.current) {
        return;
      }

      const saveable = saveableRef.current;

      if (snapshotPayload(saveable) === lastSavedSnapshotRef.current) {
        return;
      }

      void persistRef.current(saveable);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !loaded) {
      return;
    }

    const saveable = {
      countries,
      promotions,
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
  }, [countries, promotions, distributors, distributorPrices, routeConfig, enabled, loaded, persist]);

  const flushPendingSave = useCallback(async () => {
    await flushPendingSaveNow();
  }, [flushPendingSaveNow]);

  return {
    enabled,
    loaded,
    saving,
    error,
    countries,
    setCountries,
    promotions,
    setPromotions,
    catalogProducts,
    setCatalogProducts,
    distributors,
    setDistributors,
    distributorPrices,
    setDistributorPrices,
    routeConfig,
    setRouteConfig,
    reload: loadRemote,
    flushPendingSave,
  };
}
