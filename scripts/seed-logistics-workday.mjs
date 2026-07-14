/**
 * Demo local: 25 invoices (15 entregar + 10 recoger) asignadas a Conductor 1.
 * Uso: node scripts/seed-logistics-workday.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { connectPg } from "./lib/db-connection.mjs";

const SCGS_ORG_ID = process.env.SCGS_ORG_ID || "2029bf0c-e766-4840-9d90-f4b252cc3fe9";
const DEMO_PREFIX = "INV-WD-";
const DEMO_EMAIL_PREFIX = "workday.demo+";
const OUT_DIR = "/tmp/boxario-logistics-workday";

const BOX_PRICING = {
  "14x14x14": { paid: "$35", cost: "$22" },
  "16x16x16": { paid: "$50", cost: "$31" },
};

const CUSTOMERS = [
  ["Ana", "Morales", "661-555-0101", "Golden Valley Rd", "19205", "Canyon Country", "Santa Clarita", "CA", "91387", 34.41495, -118.45977, "Entregar", "14x14x14", 1],
  ["Luis", "Herrera", "661-555-0102", "Bouquet Canyon Rd", "26650", "Saugus", "Santa Clarita", "CA", "91350", 34.43891, -118.53593, "Entregar", "16x16x16", 1],
  ["Sandra", "Ruiz", "661-555-0103", "Soledad Canyon Rd", "18358", "Canyon Country", "Santa Clarita", "CA", "91351", 34.41639, -118.45274, "Entregar", "14x14x14", 1],
  ["Fernando", "Castro", "661-555-0104", "McBean Pkwy", "24303", "Valencia", "Santa Clarita", "CA", "91355", 34.41309, -118.56041, "Entregar", "14x14x14", 2],
  ["Marta", "Pineda", "661-555-0105", "Newhall Ranch Rd", "27550", "Valencia", "Santa Clarita", "CA", "91355", 34.44009, -118.54852, "Entregar", "16x16x16", 1],
  ["Carlos", "Vega", "661-555-0106", "Via Princessa", "18635", "Canyon Country", "Santa Clarita", "CA", "91387", 34.41236, -118.46922, "Entregar", "16x16x16", 1],
  ["Rosa", "Navarro", "661-555-0107", "Railroad Ave", "22935", "Newhall", "Santa Clarita", "CA", "91321", 34.37941, -118.52732, "Entregar", "14x14x14", 1],
  ["Jorge", "Salazar", "661-555-0108", "Lyons Ave", "24250", "Newhall", "Santa Clarita", "CA", "91321", 34.37821, -118.55709, "Entregar", "16x16x16", 2],
  ["Daniel", "Rios", "661-555-0116", "Davenport Rd", "28450", "Saugus", "Santa Clarita", "CA", "91350", 34.44712, -118.52104, "Entregar", "14x14x14", 1],
  ["Carmen", "Silva", "661-555-0117", "Decoro Dr", "24580", "Valencia", "Santa Clarita", "CA", "91355", 34.40588, -118.55421, "Entregar", "16x16x16", 1],
  ["Pedro", "Guzman", "661-555-0118", "Hasley Canyon Rd", "25200", "Castaic", "Santa Clarita", "CA", "91384", 34.46831, -118.61204, "Entregar", "14x14x14", 1],
  ["Lucia", "Marin", "661-555-0119", "Creekside Rd", "22900", "Newhall", "Santa Clarita", "CA", "91350", 34.39102, -118.54133, "Entregar", "14x14x14", 2],
  ["Oscar", "Delgado", "661-555-0120", "Wiley Canyon Rd", "23500", "Newhall", "Santa Clarita", "CA", "91321", 34.36741, -118.51288, "Entregar", "16x16x16", 1],
  ["Teresa", "Campos", "661-555-0121", "Sand Canyon Rd", "28100", "Canyon Country", "Santa Clarita", "CA", "91387", 34.42851, -118.47892, "Entregar", "16x16x16", 1],
  ["Raul", "Medina", "661-555-0122", "Valencia Blvd", "24200", "Valencia", "Santa Clarita", "CA", "91355", 34.40981, -118.57102, "Entregar", "14x14x14", 1],
  ["Elena", "Cortez", "661-555-0109", "Sierra Hwy", "27567", "Canyon Country", "Santa Clarita", "CA", "91351", 34.42296, -118.45481, "Recoger", "14x14x14", 1],
  ["Miguel", "Ortega", "661-555-0110", "Copper Hill Dr", "27745", "Saugus", "Santa Clarita", "CA", "91350", 34.46041, -118.53622, "Recoger", "16x16x16", 1],
  ["Patricia", "Lopez", "661-555-0111", "Seco Canyon Rd", "27931", "Saugus", "Santa Clarita", "CA", "91350", 34.45473, -118.53148, "Recoger", "16x16x16", 1],
  ["Hector", "Mendoza", "661-555-0112", "Tournament Rd", "24700", "Valencia", "Santa Clarita", "CA", "91355", 34.39701, -118.56828, "Recoger", "14x14x14", 2],
  ["Isabel", "Torres", "661-555-0113", "Plum Canyon Rd", "19130", "Saugus", "Santa Clarita", "CA", "91350", 34.45964, -118.50621, "Recoger", "16x16x16", 1],
  ["Roberto", "Funes", "661-555-0114", "Magic Mountain Pkwy", "26111", "Valencia", "Santa Clarita", "CA", "91355", 34.42152, -118.58537, "Recoger", "14x14x14", 1],
  ["Beatriz", "Aguilar", "661-555-0115", "Whites Canyon Rd", "18625", "Canyon Country", "Santa Clarita", "CA", "91351", 34.42213, -118.46621, "Recoger", "14x14x14", 1],
  ["Gabriel", "Nunez", "661-555-0123", "Ruether Ave", "26600", "Canyon Country", "Santa Clarita", "CA", "91351", 34.41902, -118.44881, "Recoger", "16x16x16", 1],
  ["Diana", "Soto", "661-555-0124", "Smyth Dr", "25800", "Valencia", "Santa Clarita", "CA", "91355", 34.40122, -118.56241, "Recoger", "14x14x14", 1],
  ["Alberto", "Reyes", "661-555-0125", "Mint Canyon Rd", "29400", "Canyon Country", "Santa Clarita", "CA", "91387", 34.43501, -118.44102, "Recoger", "16x16x16", 1],
];

const RECIPIENTS = [
  ["Rosa", "Garcia", "Mexico", "Av. Chapultepec", "245", "Americana", "Guadalajara", "Jalisco", "44160"],
  ["Elena", "Vargas", "Mexico", "Av. Constitucion", "1520", "Centro", "Monterrey", "Nuevo Leon", "64000"],
  ["Pedro", "Jimenez", "Mexico", "Insurgentes Sur", "892", "Del Valle", "Ciudad de Mexico", "CDMX", "03100"],
];

function nowIso() {
  return new Date().toISOString();
}

function logProgress(message) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.appendFileSync(path.join(OUT_DIR, "progress.log"), `[${nowIso()}] ${message}\n`, "utf8");
  console.log(message);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(filePath, rows) {
  const headers = [
    "phase",
    "code",
    "customer",
    "action",
    "task_status",
    "scheduled_at",
    "driver_id",
    "address",
    "box",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

async function snapshotDemoRows(client, phase) {
  const { rows } = await client.query(
    `
      select
        $2::text as phase,
        s.code,
        s.customer_name as customer,
        case t.task_type
          when 'deliver_empty_box' then 'Entregar'
          when 'pickup_full_box' then 'Recoger'
          else ''
        end as action,
        t.status as task_status,
        t.scheduled_at,
        t.assigned_to as driver_id,
        coalesce(c.formatted_address, '') as address,
        s.logistics_plan #>> '{box,label}' as box
      from public.shipments s
      left join public.shipment_logistics_tasks t on t.shipment_id = s.id
      left join public.customers c on c.id = s.customer_id
      where s.organization_id = $1
        and s.code like '${DEMO_PREFIX}%'
      order by s.code
    `,
    [SCGS_ORG_ID, phase],
  );

  return rows;
}

async function ensureOrgAndOwner(client) {
  const org = await client.query(
    "select id, name from public.organizations where id = $1",
    [SCGS_ORG_ID],
  );
  if (!org.rowCount) {
    throw new Error(`No existe org SCGS: ${SCGS_ORG_ID}`);
  }

  const owner = await client.query(
    `
      select p.id
      from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.organization_id = $1
        and p.is_active = true
      order by case when r.slug = 'administrador' then 0 else 1 end, p.created_at asc
      limit 1
    `,
    [SCGS_ORG_ID],
  );
  if (!owner.rowCount) {
    throw new Error("No hay usuario activo para asignar ventas demo.");
  }

  const warehouse = await client.query(
    `
      select id
      from public.warehouses
      where organization_id = $1
      order by is_default desc, created_at asc
      limit 1
    `,
    [SCGS_ORG_ID],
  );

  return {
    orgName: org.rows[0].name,
    ownerId: owner.rows[0].id,
    warehouseId: warehouse.rows[0]?.id ?? null,
  };
}

function formattedAddress(row) {
  const [, , , street, house, , city, state, zip] = row;
  return `${street} ${house}, ${city}, ${state} ${zip}, USA`;
}

function recipientSnapshot(index) {
  const row = RECIPIENTS[index % RECIPIENTS.length];
  return {
    firstName: row[0],
    lastName: row[1],
    phone: "+52-55-5555-0101",
    country: row[2],
    street: row[3],
    houseNumber: row[4],
    neighborhood: row[5],
    city: row[6],
    state: row[7],
    postalCode: row[8],
  };
}

function catalogKey(boxSize) {
  return `cajas|${boxSize.toLowerCase()}|`;
}

function boxLine(boxSize, quantity) {
  const pricing = BOX_PRICING[boxSize] || { paid: "$50", cost: "$31" };
  return {
    cost: pricing.cost,
    paid: pricing.paid,
    time: "3-5 dias",
    label: boxSize,
    carrier: "",
    quantity,
    catalogKey: catalogKey(boxSize),
  };
}

async function loadInventoryBoxSizes(client) {
  const { rows } = await client.query(
    `
      select distinct ii.kind
      from public.inventory_items ii
      join public.inventory_categories ic on ic.id = ii.category_id
      where ii.organization_id = $1
        and lower(ic.name) = 'cajas'
      order by ii.kind
    `,
    [SCGS_ORG_ID],
  );

  return rows.map((row) => row.kind);
}

function assertCustomersUseInventoryBoxSizes(inventorySizes) {
  const allowed = new Set(inventorySizes.map((size) => size.toLowerCase()));
  const missing = new Set();

  for (const row of CUSTOMERS) {
    const boxSize = String(row[12] || "").toLowerCase();
    if (!allowed.has(boxSize)) {
      missing.add(row[12]);
    }
  }

  if (missing.size) {
    throw new Error(
      `El seed usa cajas que no existen en inventario: ${[...missing].join(", ")}. Disponibles: ${inventorySizes.join(", ")}`,
    );
  }
}

function logisticsPlan(action, boxSize, boxQty, warehouseId) {
  const line = boxLine(boxSize, boxQty);
  const subtotal = boxQty * Number.parseInt(line.paid.replace(/\D/g, ""), 10);

  if (action === "Recoger") {
    return {
      box: { cost: line.cost, paid: line.paid, time: line.time, label: boxSize, carrier: "" },
      fees: { total: "$0", fullBoxPickup: "$0", emptyBoxDelivery: "$0" },
      notes: "",
      billing: {
        payNow: "$0",
        boxCount: boxQty,
        balanceDue: line.paid,
        boxSubtotal: line.paid,
        quotedTotal: line.paid,
        boxUnitPrice: line.paid,
        fullBoxPickup: "$0",
        minimumDeposit: "$20",
        emptyBoxDelivery: "$0",
        logisticsFeeMode: "per_trip",
        logisticsSubtotal: "$0",
        promotionDiscount: "$0",
        boxSubtotalBeforeDiscount: line.paid,
        promotionSelectionRequired: false,
        promotionCandidates: [],
        cartLines: [line],
        promotion: null,
      },
      fullBox: {
        mode: "Recoger caja llena a domicilio",
        label: "full_box",
        deferred: true,
        scheduleAt: null,
        scheduleMode: null,
        driverTaskType: "pickup_full_box",
        driverTaskNeeded: true,
      },
      summary: "Caja vacia: Cliente ya tiene caja vacia | Caja llena: Recoleccion pendiente",
      boxCount: boxQty,
      boxLines: [line],
      emptyBox: {
        mode: "Cliente ya tiene caja vacia",
        label: "empty_box",
        handingNow: null,
        scheduleAt: null,
        warehouseId,
        scheduleMode: null,
        driverTaskType: null,
        driverTaskNeeded: false,
      },
      driverTaskCount: 1,
    };
  }

  return {
    box: { cost: line.cost, paid: line.paid, time: line.time, label: boxSize, carrier: "" },
    fees: { total: "$0", fullBoxPickup: "$0", emptyBoxDelivery: "$0" },
    notes: "",
    billing: {
      payNow: "$0",
      boxCount: boxQty,
      balanceDue: `$${subtotal}`,
      boxSubtotal: `$${subtotal}`,
      quotedTotal: `$${subtotal}`,
      boxUnitPrice: line.paid,
      fullBoxPickup: "$0",
      minimumDeposit: "$20",
      emptyBoxDelivery: "$0",
      logisticsFeeMode: "per_trip",
      logisticsSubtotal: "$0",
      promotionDiscount: "$0",
      boxSubtotalBeforeDiscount: `$${subtotal}`,
      promotionSelectionRequired: false,
      promotionCandidates: [],
      cartLines: [line],
      promotion: null,
    },
    fullBox: {
      mode: "Recoger caja llena a domicilio",
      label: "full_box",
      deferred: true,
      scheduleAt: null,
      scheduleMode: null,
      driverTaskType: null,
      driverTaskNeeded: false,
    },
    summary: "Caja vacia: Entregar caja vacia a domicilio | Caja llena: Recoleccion pendiente",
    boxCount: boxQty,
    boxLines: [line],
    emptyBox: {
      mode: "Entregar caja vacia a domicilio",
      label: "empty_box",
      handingNow: null,
      scheduleAt: null,
      scheduleMode: "pending",
      driverTaskType: "deliver_empty_box",
      driverTaskNeeded: true,
      warehouseId,
    },
    driverTaskCount: 1,
  };
}

async function deletePreviousDemo(client) {
  const previous = await snapshotDemoRows(client, "before");
  writeCsv(path.join(OUT_DIR, "before.csv"), previous);

  await client.query(
    `
      delete from public.logistics_route_stops
      where route_id in (
        select id from public.logistics_routes
        where organization_id = $1 and name like 'Ruta demo Conductor 1%'
      )
    `,
    [SCGS_ORG_ID],
  );
  await client.query(
    "delete from public.logistics_routes where organization_id = $1 and name like $2",
    [SCGS_ORG_ID, "Ruta demo Conductor 1%"],
  );
  await client.query(
    "delete from public.shipments where organization_id = $1 and code like $2",
    [SCGS_ORG_ID, `${DEMO_PREFIX}%`],
  );
  await client.query(
    "delete from public.customers where organization_id = $1 and email like $2",
    [SCGS_ORG_ID, `${DEMO_EMAIL_PREFIX}%`],
  );

  return previous;
}

async function insertWorkday(client, ownerId, warehouseId) {
  const base = new Date();
  base.setHours(8, 0, 0, 0);

  for (let index = 0; index < CUSTOMERS.length; index += 1) {
    const row = CUSTOMERS[index];
    const [firstName, lastName, phone, street, house, neighborhood, city, state, zip, lat, lng, action, boxSize, boxQty] = row;
    const code = `${DEMO_PREFIX}${String(index + 1).padStart(3, "0")}`;
    const scheduledAt = new Date(base.getTime() + index * 35 * 60 * 1000).toISOString();
    const address = formattedAddress(row);
    const boxSummary = boxQty > 1 ? `${boxSize} x${boxQty}` : boxSize;

    const customer = await client.query(
      `
        insert into public.customers (
          organization_id, first_name, last_name, phones, email, street, house_number,
          neighborhood, city, state, postal_code, country, place_id, formatted_address,
          lat, lng, geo_updated_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'USA',$12,$13,$14,$15,now())
        returning id
      `,
      [
        SCGS_ORG_ID,
        firstName,
        lastName,
        [phone],
        `${DEMO_EMAIL_PREFIX}${index + 1}@boxario.test`,
        street,
        house,
        neighborhood,
        city,
        state,
        zip,
        `demo-workday-${index + 1}`,
        address,
        lat,
        lng,
      ],
    );

    const recipient = recipientSnapshot(index);
    const shipment = await client.query(
      `
        insert into public.shipments (
          organization_id, code, customer_id, recipient_snapshot, customer_name, country,
          carrier, paid, profit, status, assigned_to, created_by, sales_owner_id, sale_kind,
          invoice_status, accounting_status, finalized_at, empty_box_delivered_at,
          delivery_notes, logistics_plan, created_at
        )
        values (
          $1,$2,$3,$4,$5,'Mexico','SCGS',$6,$7,'Pendiente',$8,$9,$9,'empty_box_deposit',
          'open','not_exportable',null,$10,$11,$12,now()
        )
        returning id
      `,
      [
        SCGS_ORG_ID,
        code,
        customer.rows[0].id,
        JSON.stringify(recipient),
        `${firstName} ${lastName}`,
        action === "Recoger" ? 20 : 0,
        action === "Recoger" ? 8 : 0,
        null,
        ownerId,
        action === "Recoger" ? new Date(base.getTime() - 24 * 60 * 60 * 1000).toISOString() : null,
        `Demo workday: ${action.toLowerCase()} ${boxSummary}`,
        JSON.stringify(logisticsPlan(action, boxSize, boxQty, warehouseId)),
      ],
    );

    await client.query(
      `
        insert into public.shipment_logistics_tasks (
          organization_id, shipment_id, task_type, status, assigned_to, scheduled_at,
          warehouse_id, notes, created_at
        )
        values ($1,$2,$3,'pending',null,$4,$5,$6,now())
      `,
      [
        SCGS_ORG_ID,
        shipment.rows[0].id,
        action === "Recoger" ? "pickup_full_box" : "deliver_empty_box",
        scheduledAt,
        warehouseId,
        `${action} ${boxSummary} - ${address}`,
      ],
    );
  }
}

async function assignRouteToConductor1(client, ownerId, warehouseId) {
  const conductor = await client.query(
    `
      select id, full_name
      from public.profiles
      where email = 'conductor1@scgs.local'
        and organization_id = $1
      limit 1
    `,
    [SCGS_ORG_ID],
  );

  if (!conductor.rowCount) {
    throw new Error("No existe Conductor 1. Ejecuta: node scripts/seed-conductors.mjs");
  }

  const conductorId = conductor.rows[0].id;
  const routeDate = new Date().toISOString().slice(0, 10);

  const vehicle = await client.query(
    `
      select id
      from public.logistics_vehicles
      where organization_id = $1
        and is_active = true
      order by created_at asc
      limit 1
    `,
    [SCGS_ORG_ID],
  );

  const tasks = await client.query(
    `
      select
        t.id as task_id,
        s.id as shipment_id,
        c.formatted_address,
        c.lat,
        c.lng,
        c.postal_code,
        c.city,
        t.scheduled_at
      from public.shipment_logistics_tasks t
      join public.shipments s on s.id = t.shipment_id
      join public.customers c on c.id = s.customer_id
      where s.organization_id = $1
        and s.code like $2
      order by t.scheduled_at asc nulls last, s.code asc
    `,
    [SCGS_ORG_ID, `${DEMO_PREFIX}%`],
  );

  if (!tasks.rowCount) {
    throw new Error("No hay tareas demo para asignar.");
  }

  const route = await client.query(
    `
      insert into public.logistics_routes (
        organization_id, route_date, name, status, assigned_to, vehicle_id,
        warehouse_id, zone_key, published_at, created_by, created_at
      )
      values ($1,$2,$3,'planned',$4,$5,$6,$7,now(),$8,now())
      returning id
    `,
    [
      SCGS_ORG_ID,
      routeDate,
      `Ruta demo Conductor 1 ${routeDate}`,
      conductorId,
      vehicle.rows[0]?.id ?? null,
      warehouseId,
      "santa-clarita",
      ownerId,
    ],
  );

  const routeId = route.rows[0].id;
  const now = new Date().toISOString();

  for (let index = 0; index < tasks.rows.length; index += 1) {
    const task = tasks.rows[index];
    await client.query(
      `
        insert into public.logistics_route_stops (
          organization_id, route_id, task_id, stop_order, address_snapshot,
          lat, lng, postal_code, city, created_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
      `,
      [
        SCGS_ORG_ID,
        routeId,
        task.task_id,
        index + 1,
        JSON.stringify({ formattedAddress: task.formatted_address }),
        task.lat,
        task.lng,
        task.postal_code,
        task.city,
      ],
    );

    await client.query(
      `
        update public.shipment_logistics_tasks
        set assigned_to = $2, assigned_at = $3, status = 'assigned', updated_at = $3
        where id = $1
      `,
      [task.task_id, conductorId, now],
    );

    await client.query(
      `
        update public.shipments
        set assigned_to = $2
        where id = $1
      `,
      [task.shipment_id, conductorId],
    );
  }

  return {
    conductorName: conductor.rows[0].full_name,
    routeId,
    taskCount: tasks.rowCount,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "progress.log"), "", "utf8");
  logProgress("Seed workday demo: 0% - iniciando");

  const { client, label } = await connectPg();
  try {
    const { orgName, ownerId, warehouseId } = await ensureOrgAndOwner(client);
    const inventorySizes = await loadInventoryBoxSizes(client);
    assertCustomersUseInventoryBoxSizes(inventorySizes);
    logProgress(`Seed workday demo: 15% - DB ${label}, org ${orgName}, cajas ${inventorySizes.join(", ")}`);

    await client.query("begin");
    const before = await deletePreviousDemo(client);
    logProgress(`Seed workday demo: 35% - demo anterior removido: ${before.length} tareas`);

    await insertWorkday(client, ownerId, warehouseId);
    logProgress("Seed workday demo: 70% - envios creados");

    const assignment = await assignRouteToConductor1(client, ownerId, warehouseId);
    logProgress(
      `Seed workday demo: 90% - ruta asignada a ${assignment.conductorName} (${assignment.taskCount} tareas)`,
    );

    const after = await snapshotDemoRows(client, "after");
    writeCsv(path.join(OUT_DIR, "after.csv"), after);
    writeCsv(path.join(OUT_DIR, "before-after.csv"), [...before, ...after]);

    await client.query("commit");

    const report = [
      "verdict,metric,value",
      `ok,invoices_created,${after.length}`,
      `ok,deliveries,${after.filter((row) => row.action === "Entregar").length}`,
      `ok,pickups,${after.filter((row) => row.action === "Recoger").length}`,
      `ok,scheduled_day,${new Date().toISOString().slice(0, 10)}`,
    ].join("\n");
    fs.writeFileSync(path.join(OUT_DIR, "report.csv"), `${report}\n`, "utf8");

    logProgress("Seed workday demo: 100% - terminado");
    console.log(`\nCSV antes: ${path.join(OUT_DIR, "before.csv")}`);
    console.log(`CSV despues: ${path.join(OUT_DIR, "after.csv")}`);
    console.log(`Reporte: ${path.join(OUT_DIR, "report.csv")}`);
    console.log(`Progreso: ${path.join(OUT_DIR, "progress.log")}`);
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
