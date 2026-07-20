import { redirect } from "next/navigation";

export default function SeguimientoHistorialPage() {
  redirect("/seguimiento?view=history");
}
