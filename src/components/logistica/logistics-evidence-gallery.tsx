"use client";

import { useEffect, useState } from "react";
import { Camera, ExternalLink, Loader2 } from "lucide-react";
import { listLogisticsTaskEvidenceAction } from "@/app/actions/logistics-routes";
import { cardClass, secondaryButtonClass } from "@/components/ui-blocks";
import type { LogisticsEvidenceItem } from "@/lib/logistics-evidence";

type LogisticsEvidenceGalleryProps = {
  className?: string;
};

export function LogisticsEvidenceGallery({ className = "" }: LogisticsEvidenceGalleryProps) {
  const [items, setItems] = useState<LogisticsEvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      const result = await listLogisticsTaskEvidenceAction();

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setError(result.error);
        setItems([]);
      } else {
        setError(null);
        setItems(result.data);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <div className={className}>
      <button
        type="button"
        className={`${secondaryButtonClass} h-9 w-full justify-between px-3 text-xs`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="inline-flex items-center gap-2">
          <Camera className="h-4 w-4 text-emerald-300" />
          Evidencia de campo
        </span>
        {open && !loading ? (
          <span className="rounded-full border border-black bg-surface-inset px-1.5 py-0.5 text-[10px] font-black">
            {items.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className={`${cardClass} mt-2 p-3`}>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm font-bold text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando evidencia…
            </div>
          ) : error ? (
            <p className="py-4 text-center text-sm font-bold text-rose-300">{error}</p>
          ) : items.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-lg border border-black bg-surface-inset"
                >
                  <a
                    href={item.evidenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block aspect-video overflow-hidden bg-[#111816]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.evidenceUrl}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  </a>
                  <div className="grid gap-1 p-2">
                    <p className="truncate text-xs font-black text-[#f8fafc]">
                      {item.shipmentCode || item.title}
                    </p>
                    <p className="truncate text-[10px] font-bold text-slate-500">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                    <a
                      href={item.evidenceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`${secondaryButtonClass} h-8 text-[11px]`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm font-bold text-slate-500">
              Sin fotos de evidencia registradas.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
