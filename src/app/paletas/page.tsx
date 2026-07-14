import { listWarehousePackagesAction, listWarehousePalletsAction } from "@/app/actions/physical-packages";
import { PalletsClient } from "@/components/warehouse/pallets-client";
import { requirePathAccess } from "@/lib/auth/require";
export default async function PaletasPage() { await requirePathAccess("/paletas"); const [pallets, packages] = await Promise.all([listWarehousePalletsAction(), listWarehousePackagesAction(["in_warehouse"])]); return <PalletsClient initialPallets={pallets.ok ? pallets.data : []} initialPackages={packages.ok ? packages.data : []} />; }
