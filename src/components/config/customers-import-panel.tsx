"use client";

import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  downloadCustomersImportTemplateAction,
  importCustomersFromRowsAction,
  previewCustomersImportAction,
  type CustomersImportPreviewResult,
} from "@/app/actions/customers-import";
import {
  settingsIconBoxClass,
  settingsSectionClass,
  settingsSectionHeaderClass,
  settingsSectionTitleClass,
} from "@/components/config/settings-panel-styles";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";

function downloadBase64File(filename: string, base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CustomersImportPanel() {
  const notify = useNotify();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<CustomersImportPreviewResult | null>(null);
  const [fileName, setFileName] = useState("");

  function downloadTemplate() {
    startTransition(async () => {
      const result = await downloadCustomersImportTemplateAction();
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      downloadBase64File(result.data.filename, result.data.base64);
      notify.success("Plantilla descargada.");
    });
  }

  function onFileSelected(file: File | null) {
    if (!file) {
      return;
    }

    setFileName(file.name);
    setPreview(null);

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const result = await previewCustomersImportAction(formData);
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      setPreview(result.data);
      if (result.data.validSenderCount === 0) {
        notify.error("No hay filas válidas para importar. Revisa los errores.");
        return;
      }
      notify.success(
        `Listo para importar: ${result.data.validSenderCount} remitente(s), ${result.data.validRecipientCount} destinatario(s).`,
      );
    });
  }

  function confirmImport() {
    if (!preview || preview.groups.length === 0) {
      return;
    }

    startTransition(async () => {
      const result = await importCustomersFromRowsAction({ groups: preview.groups });
      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      const skipNote =
        result.data.skippedErrors.length > 0
          ? ` (${result.data.skippedErrors.length} con error al guardar)`
          : "";
      notify.success(
        `Importados ${result.data.createdCustomers} remitente(s) y ${result.data.createdRecipients} destinatario(s)${skipNote}.`,
      );
      setPreview(null);
      setFileName("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      router.refresh();
    });
  }

  const errorRows = preview
    ? [...preview.headerErrors.map((message) => ({ rowNumber: 1, message })), ...preview.rowErrors]
    : [];

  return (
    <div className="grid gap-4">
      <section className={settingsSectionClass}>
        <div className={settingsSectionHeaderClass}>
          <div className={settingsSectionTitleClass}>
            <span className={settingsIconBoxClass}>
              <FileSpreadsheet className="h-4 w-4" />
            </span>
            Importar remitentes y destinatarios
          </div>
        </div>

        <div className="grid gap-4 p-4">
          <p className="text-sm font-semibold leading-relaxed text-slate-300">
            Descarga la plantilla Excel, llena el bloque verde (remitente) y el ámbar (destinatario),
            y súbelo aquí. Misma <span className="font-black text-emerald-300">remitente_clave</span>{" "}
            = un remitente con varios destinatarios. El país del destinatario debe existir ya en
            Países y precios.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={downloadTemplate}
              className={secondaryButtonClass}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Descargar plantilla
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() => fileInputRef.current?.click()}
              className={secondaryButtonClass}
            >
              <Upload className="h-4 w-4" />
              Subir Excel
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(event) => onFileSelected(event.target.files?.[0] || null)}
            />
          </div>

          {fileName ? (
            <p className="text-xs font-bold text-slate-400">
              Archivo: <span className="text-slate-200">{fileName}</span>
            </p>
          ) : null}

          {preview ? (
            <div className="grid gap-3 rounded-lg border border-black bg-surface-inset p-3">
              <div className="flex flex-wrap gap-3 text-sm font-black text-slate-100">
                <span>
                  Filas leídas: <b className="text-emerald-300">{preview.totalDataRows}</b>
                </span>
                <span>
                  Remitentes válidos: <b className="text-emerald-300">{preview.validSenderCount}</b>
                </span>
                <span>
                  Destinatarios válidos:{" "}
                  <b className="text-emerald-300">{preview.validRecipientCount}</b>
                </span>
                <span>
                  Errores: <b className="text-amber-300">{errorRows.length}</b>
                </span>
              </div>

              {errorRows.length > 0 ? (
                <div className="max-h-48 overflow-y-auto rounded-md border border-black/70 bg-surface-card p-2">
                  <ul className="grid gap-1 text-xs font-semibold text-amber-200">
                    {errorRows.slice(0, 40).map((error, index) => (
                      <li key={`${error.rowNumber}-${index}`}>
                        {error.rowNumber > 0 ? `Fila ${error.rowNumber}: ` : ""}
                        {error.message}
                      </li>
                    ))}
                    {errorRows.length > 40 ? (
                      <li>… y {errorRows.length - 40} error(es) más.</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              <button
                type="button"
                disabled={pending || preview.validSenderCount === 0}
                onClick={confirmImport}
                className={primaryButtonClass}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Importar {preview.validSenderCount} válidos
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
