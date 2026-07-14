"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useOnboardingCoachState } from "@/components/onboarding/onboarding-coach-context";
import {
  coachRectsForElements,
  coachTooltipAnchorRect,
  computeCoachTooltipPosition,
  onboardingCoachTargetKeys,
  queryOnboardingCoachTargets,
  type OnboardingCoachHint,
  type OnboardingCoachRect,
} from "@/lib/onboarding/coach-targets";

function computeTooltipPosition(rect: OnboardingCoachRect, tooltipHeight: number) {
  return computeCoachTooltipPosition(
    rect,
    tooltipHeight,
    window.innerWidth,
    window.innerHeight,
  );
}

function OnboardingCoachTooltip({
  hint,
  rect,
  className = "z-[260]",
}: {
  hint: OnboardingCoachHint;
  rect: OnboardingCoachRect;
  className?: string;
}) {
  const position = computeTooltipPosition(rect, 120);

  return (
    <div
      className={`pointer-events-none fixed rounded-xl border border-emerald-500/40 bg-[#0f1714]/95 p-3 shadow-[0_18px_48px_rgba(0,0,0,0.55)] backdrop-blur-sm ${className}`}
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/20 text-emerald-300">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wide text-emerald-300/90">
            Tip del tutorial
          </p>
          <p className="mt-0.5 text-sm font-black leading-snug text-[#f8fafc]">
            {hint.title}
          </p>
          <p className="mt-1 text-xs font-bold leading-relaxed text-slate-300">
            {hint.body}
          </p>
        </div>
      </div>
    </div>
  );
}

function CoachDimLayer({
  rects,
  dimAlpha,
  zIndex,
  maskId,
}: {
  rects: OnboardingCoachRect[];
  dimAlpha: number;
  zIndex: number;
  maskId: string;
}) {
  if (rects.length === 1) {
    const rect = rects[0];

    return (
      <div
        className="pointer-events-none fixed rounded-xl"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          boxShadow: `0 0 0 9999px rgba(0, 0, 0, ${dimAlpha})`,
          zIndex,
        }}
        aria-hidden
      />
    );
  }

  return (
    <svg
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex }}
      aria-hidden
    >
      <defs>
        <mask id={maskId}>
          <rect width="100%" height="100%" fill="white" />
          {rects.map((rect, index) => (
            <rect
              key={index}
              x={rect.left}
              y={rect.top}
              width={rect.width}
              height={rect.height}
              rx="12"
              fill="black"
            />
          ))}
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill={`rgba(0, 0, 0, ${dimAlpha})`}
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}

export function OnboardingCoachOverlay() {
  const coach = useOnboardingCoachState();
  const hint = coach?.hint ?? null;
  const notificationsPanelOpen = coach?.notificationsPanelOpen ?? false;
  const maskId = useId().replace(/:/g, "");
  const [spotlightRects, setSpotlightRects] = useState<OnboardingCoachRect[]>([]);
  const [tooltipRect, setTooltipRect] = useState<OnboardingCoachRect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useLayoutEffect(() => {
    if (!hint) {
      const frame = window.requestAnimationFrame(() => {
        setSpotlightRects([]);
        setTooltipRect(null);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    // El callback vive más tiempo que el render y TypeScript no conserva el
    // narrowing de `hint` dentro de esa clausura.
    const activeHint = hint;

    const glowTargets = new Set<HTMLElement>();

    function clearGlowTargets() {
      for (const target of glowTargets) {
        target.classList.remove("onboarding-coach-target-glow");
      }

      glowTargets.clear();
    }

    function refreshTarget() {
      const elements = queryOnboardingCoachTargets(onboardingCoachTargetKeys(activeHint));

      if (elements.length === 0) {
        clearGlowTargets();
        setSpotlightRects([]);
        setTooltipRect(null);
        return;
      }

      clearGlowTargets();

      for (const element of elements) {
        element.classList.add("onboarding-coach-target-glow");
        glowTargets.add(element);
      }

      setSpotlightRects(coachRectsForElements(elements));
      setTooltipRect(coachTooltipAnchorRect(elements));

      if (elements.length === 1) {
        elements[0].scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }

    refreshTarget();

    const retry = window.setInterval(refreshTarget, 400);
    window.addEventListener("resize", refreshTarget);
    window.addEventListener("scroll", refreshTarget, true);

    return () => {
      window.clearInterval(retry);
      window.removeEventListener("resize", refreshTarget);
      window.removeEventListener("scroll", refreshTarget, true);
      clearGlowTargets();
    };
  }, [hint]);

  // Cuando el panel está abierto, la guía vive dentro de Notificaciones. El
  // overlay no debe oscurecer ni cubrir sus pasos; el CTA se resalta en línea.
  if (
    !mounted ||
    !hint ||
    notificationsPanelOpen ||
    spotlightRects.length === 0 ||
    !tooltipRect
  ) {
    return null;
  }

  const spotlightZ = notificationsPanelOpen ? 145 : 250;
  const ringZ = notificationsPanelOpen ? 165 : 255;
  const tooltipZ = notificationsPanelOpen ? "z-[170]" : "z-[260]";
  const dimAlpha = notificationsPanelOpen ? 0.25 : 0.45;

  return createPortal(
    <>
      <CoachDimLayer
        rects={spotlightRects}
        dimAlpha={dimAlpha}
        zIndex={spotlightZ}
        maskId={maskId}
      />
      {spotlightRects.map((rect, index) => (
        <div
          key={`ring-${index}`}
          className="onboarding-coach-ring pointer-events-none fixed rounded-xl"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            zIndex: ringZ,
          }}
          aria-hidden
        />
      ))}
      <OnboardingCoachTooltip
        hint={hint}
        rect={tooltipRect}
        className={tooltipZ}
      />
    </>,
    document.body,
  );
}
