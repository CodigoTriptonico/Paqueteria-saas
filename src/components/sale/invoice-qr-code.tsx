"use client";

import { QRCodeSVG } from "qrcode.react";
import { invoiceQrValue } from "@/lib/invoice-qr";

type InvoiceQrCodeProps = {
  invoiceNumber: string;
  trackingToken?: string;
  size?: number;
  className?: string;
};

export function InvoiceQrCode({
  invoiceNumber,
  trackingToken,
  size = 56,
  className,
}: InvoiceQrCodeProps) {
  const value = invoiceQrValue(
    invoiceNumber,
    typeof window !== "undefined" ? window.location.origin : undefined,
    trackingToken,
  );

  return (
    <div className={className}>
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        marginSize={0}
        role="img"
        aria-label={`QR del invoice ${invoiceNumber}`}
      />
    </div>
  );
}
