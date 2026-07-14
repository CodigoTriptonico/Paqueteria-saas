import { listWarehousePackagesAction } from "@/app/actions/physical-packages";
import { WarehouseClient } from "@/components/warehouse/warehouse-client";
import { requirePathAccess } from "@/lib/auth/require";
export default async function BodegaPage() { await requirePathAccess("/bodega"); const [intake, warehouse] = await Promise.all([listWarehousePackagesAction(["warehouse_intake"]), listWarehousePackagesAction(["in_warehouse"])]); return <WarehouseClient initialIntake={intake.ok ? intake.data : []} initialWarehouse={warehouse.ok ? warehouse.data : []} />; }
