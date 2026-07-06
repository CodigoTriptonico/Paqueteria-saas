import { redirect } from "next/navigation";

export default function VendedoresRedirectPage() {
  redirect("/estadisticas?view=ventas");
}
