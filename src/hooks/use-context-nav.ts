import { useEffect, useRef } from "react";
import { useSetShellConfig } from "@/components/app-frame";

type UseContextNavOptions = {
  title: string;
  onBack: () => void;
  target?: string;
  keepBrand?: boolean;
  enabled?: boolean;
};

export function useContextNav({
  title,
  onBack,
  target,
  keepBrand = false,
  enabled = true,
}: UseContextNavOptions) {
  const setShellConfig = useSetShellConfig();
  const onBackRef = useRef(onBack);
  const lastAppliedRef = useRef<string | null>(null);

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!enabled) {
      if (lastAppliedRef.current !== null) {
        lastAppliedRef.current = null;
        setShellConfig({});
      }
      return;
    }

    const signature = title;

    if (lastAppliedRef.current === signature) {
      return;
    }

    lastAppliedRef.current = signature;
    setShellConfig({
      contextNavLabel: title,
      onContextNavBack: () => onBackRef.current(),
      contextNavTarget: target,
      contextNavKeepBrand: keepBrand,
    });
  }, [enabled, keepBrand, setShellConfig, target, title]);

  useEffect(() => {
    return () => {
      lastAppliedRef.current = null;
      setShellConfig({});
    };
  }, [setShellConfig]);
}
