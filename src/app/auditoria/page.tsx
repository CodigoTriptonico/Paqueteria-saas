import { redirect } from "next/navigation";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ shipment?: string | string[] }>;
}) {
  const params = await searchParams;
  const shipment = typeof params.shipment === "string" ? params.shipment : null;

  redirect(shipment ? `/seguimiento?audit=${encodeURIComponent(shipment)}` : "/seguimiento");
}
