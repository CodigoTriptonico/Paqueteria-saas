"use client";

import { QRCodeSVG } from "qrcode.react";

export function DataQrCode({
  value,
  label,
  size = 112,
  className,
}: {
  value: string;
  label: string;
  size?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        marginSize={0}
        role="img"
        aria-label={label}
      />
    </div>
  );
}
