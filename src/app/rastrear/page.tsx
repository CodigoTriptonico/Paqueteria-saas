import { Suspense } from "react";
import { PublicTrackingClient } from "@/components/public-tracking-client";

export const metadata = { title: "Rastrea tu envío | Boxario" };

export default function PublicTrackingPage() {
  return <Suspense fallback={null}><PublicTrackingClient /></Suspense>;
}
