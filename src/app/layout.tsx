import type { Metadata } from "next";
import { AppFrame } from "@/components/app-frame";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paquemas",
  description: "Sistema para paqueterias",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
