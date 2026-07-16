import type { Metadata, Viewport } from "next";
import { AppFrame } from "@/components/app-frame";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { getAppSession } from "@/lib/auth/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boxario",
  description: "Cajas e inventario para paqueterías",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#152019",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAppSession();

  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col lg:h-full lg:overflow-hidden">
        <ServiceWorkerRegister />
        <AppFrame session={session}>{children}</AppFrame>
      </body>
    </html>
  );
}
