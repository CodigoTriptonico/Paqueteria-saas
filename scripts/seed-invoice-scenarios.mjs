/**
 * Demo local: borra invoices de la org y crea escenarios de venta para dejar caja vacia.
 * Uso: node scripts/seed-invoice-scenarios.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { connectPg } from "./lib/db-connection.mjs";

const SCGS_ORG_ID = process.env.SCGS_ORG_ID || "2029bf0c-e766-4840-9d90-f4b252cc3fe9";
const OUT_DIR = "/tmp/boxario-invoice-scenarios";
const DEMO_EMAIL_PREFIX = "invoice.scenario+";

function isoFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(filePath, rows) {
  const headers = [
    "code",
    "customer_name",
    "status",
    "invoice_status",
    "empty_box_delivered_at",
    "task_type",
    "task_status",
    "scheduled_at",
    "empty_box_mode",
    "full_box_mode",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

async function snapshotInvoices(client, orgId) {
  const { rows } = await client.query(
    `
      select
        s.code,
        s.customer_name,
        s.status,
        s.invoice_status,
        s.empty_box_delivered_at,
        t.task_type,
        t.status as task_status,
        t.scheduled_at,
        s.logistics_plan #>> '{emptyBox,mode}' as empty_box_mode,
        s.logistics_plan #>> '{fullBox,mode}' as full_box_mode
      from public.shipments s
      left join public.shipment_logistics_tasks t on t.shipment_id = s.id
      where s.organization_id = $1
      order by s.created_at, s.code, t.task_type
    `,
    [orgId],
  );

  return rows;
}

async function ensureOrgContext(client) {
  const org = await client.query(
    "select id, name from public.organizations where id = $1",
    [SCGS_ORG_ID],
  );
  if (!org.rowCount) {
    throw new Error(`No existe la org: ${SCGS_ORG_ID}`);
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
    throw new Error("No hay usuario activo para crear invoices demo.");
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

async function deleteInvoices(client, orgId) {
  await client.query("delete from public.shipments where organization_id = $1", [orgId]);
  await client.query(
    "delete from public.customers where organization_id = $1 and email like $2",
    [orgId, `${DEMO_EMAIL_PREFIX}%`],
  );
  await client.query(
    "delete from public.organization_invoice_counters where organization_id = $1",
    [orgId],
  );
}

function logisticsPlan(emptyBox) {
  return {
    box: {
      label: "14x14x14",
      paid: "$50",
      cost: "$31",
    },
    boxCount: 1,
    emptyBox,
    fullBox: {},
    billing: {
      quotedTotal: "$50",
      payNow: "$10",
      balanceDue: "$40",
    },
  };
}

function recipientSnapshot(name) {
  return {
    firstName: name,
    lastName: "Destino",
    phone: "+52-55-5555-0199",
    country: "Mexico",
    street: "Av. Chapultepec",
    houseNumber: "245",
    neighborhood: "Americana",
    city: "Guadalajara",
    state: "Jalisco",
    postalCode: "44160",
  };
}

async function insertRecipient(client, orgId, customerId, snapshot) {
  const { rows } = await client.query(
    `
      insert into public.customer_recipients (
        organization_id, customer_id, first_name, last_name, phone, country,
        street, house_number, neighborhood, city, state, postal_code
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      returning id
    `,
    [
      orgId,
      customerId,
      snapshot.firstName,
      snapshot.lastName,
      snapshot.phone,
      snapshot.country,
      snapshot.street,
      snapshot.houseNumber,
      snapshot.neighborhood,
      snapshot.city,
      snapshot.state,
      snapshot.postalCode,
    ],
  );

  return rows[0].id;
}

async function insertCustomer(client, orgId, index, firstName, lastName, phone, address) {
  const { rows } = await client.query(
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
      orgId,
      firstName,
      lastName,
      [phone],
      `${DEMO_EMAIL_PREFIX}${index}@boxario.test`,
      address.street,
      address.house,
      address.neighborhood,
      address.city,
      address.state,
      address.zip,
      `invoice-scenario-${index}`,
      `${address.house} ${address.street}, ${address.city}, ${address.state} ${address.zip}, USA`,
      address.lat,
      address.lng,
    ],
  );

  return rows[0].id;
}

async function insertScenario(client, context, scenario) {
  const customerId = await insertCustomer(
    client,
    SCGS_ORG_ID,
    scenario.index,
    scenario.firstName,
    scenario.lastName,
    scenario.phone,
    scenario.address,
  );
  const snapshot = recipientSnapshot(scenario.firstName);
  await insertRecipient(client, SCGS_ORG_ID, customerId, snapshot);

  const { rows } = await client.query(
    `
      insert into public.shipments (
        organization_id, code, customer_id, recipient_snapshot, customer_name, country,
        carrier, paid, profit, status, assigned_to, created_by, sales_owner_id, sale_kind,
        invoice_status, accounting_status, finalized_at, empty_box_delivered_at,
        full_box_collected_at, office_received_at, departed_at, shipped_at, delivered_at,
        delivery_notes, logistics_plan, created_at
      )
      values (
        $1,$2,$3,$4,$5,'Mexico','SCGS',$6,0,$7,null,$8,$8,'full',
        'open','not_exportable',null,$9,null,null,null,null,null,$10,$11,$12
      )
      returning id
    `,
    [
      SCGS_ORG_ID,
      scenario.code,
      customerId,
      JSON.stringify(snapshot),
      `${scenario.firstName} ${scenario.lastName}`,
      scenario.paid,
      scenario.status,
      context.ownerId,
      scenario.emptyBoxDeliveredAt,
      scenario.notes,
      JSON.stringify(scenario.plan),
      scenario.createdAt,
    ],
  );

  if (!scenario.tasks.length) {
    return;
  }

  for (const task of scenario.tasks) {
    await client.query(
      `
        insert into public.shipment_logistics_tasks (
          organization_id, shipment_id, task_type, status, assigned_to, scheduled_at,
          warehouse_id, notes, stock_deducted_at, completed_at, created_at
        )
        values ($1,$2,$3,$4,null,$5,$6,$7,$8,$9,now())
      `,
      [
        SCGS_ORG_ID,
        rows[0].id,
        task.type,
        task.status,
        task.scheduledAt,
        context.warehouseId,
        task.notes,
        task.stockDeductedAt,
        task.completedAt,
      ],
    );
  }
}

function scenarios() {
  const names = [
    ["Ana", "Oficina"],
    ["Luis", "Ruta"],
    ["Marta", "Fecha"],
  ];
  const addresses = [
    ["Main St", "101", "Santa Clarita", "CA", "91350", 34.4389, -118.5359],
    ["Bouquet Canyon Rd", "26650", "Santa Clarita", "CA", "91350", 34.43891, -118.53593],
    ["Newhall Ranch Rd", "27550", "Santa Clarita", "CA", "91355", 34.44009, -118.54852],
    ["Soledad Canyon Rd", "18358", "Santa Clarita", "CA", "91351", 34.41639, -118.45274],
    ["Lyons Ave", "24250", "Santa Clarita", "CA", "91321", 34.37821, -118.55709],
    ["Seco Canyon Rd", "27931", "Santa Clarita", "CA", "91350", 34.45473, -118.53148],
    ["Sierra Hwy", "27567", "Santa Clarita", "CA", "91351", 34.42296, -118.45481],
    ["Copper Hill Dr", "27745", "Santa Clarita", "CA", "91350", 34.46041, -118.53622],
    ["Magic Mountain Pkwy", "26111", "Santa Clarita", "CA", "91355", 34.42152, -118.58537],
  ];
  const emptyCases = [
    {
      key: "dejar-oficina-ahora",
      label: "Dejar: cliente recoge en oficina ahora",
      delivered: true,
      plan: (deliveredAt) => ({
        mode: "Cliente recoge caja vacia en oficina",
        handingNow: true,
        stockDeductedAt: deliveredAt,
      }),
      tasks: () => [],
    },
    {
      key: "dejar-chofer-pendiente",
      label: "Dejar: chofer sin fecha",
      delivered: false,
      plan: () => ({
        mode: "Programar entrega de caja vacia",
        scheduleMode: "pending",
        scheduleAt: "",
      }),
      tasks: () => [
        {
          type: "deliver_empty_box",
          status: "pending",
          scheduledAt: null,
          notes: "Dejar caja vacia sin fecha",
          stockDeductedAt: null,
          completedAt: null,
        },
      ],
    },
    {
      key: "dejar-chofer-fecha",
      label: "Dejar: chofer con fecha",
      delivered: false,
      plan: (_deliveredAt, scheduledAt) => ({
        mode: "Programar entrega de caja vacia",
        scheduleMode: "scheduled",
        scheduleAt: scheduledAt,
      }),
      tasks: (_deliveredAt, scheduledAt) => [
        {
          type: "deliver_empty_box",
          status: "scheduled",
          scheduledAt,
          notes: "Dejar caja vacia con fecha",
          stockDeductedAt: null,
          completedAt: null,
        },
      ],
    },
  ];
  const rows = [];
  let index = 1;
  for (const emptyCase of emptyCases) {
    const deliveredAt = emptyCase.delivered ? isoFromNow(-24 - index) : null;
    const emptyScheduledAt = isoFromNow(24 + index);
    const [firstName, lastName] = names[index - 1];
    const [street, house, city, state, zip, lat, lng] = addresses[index - 1];
    const emptyPlan = emptyCase.plan(deliveredAt, emptyScheduledAt);
    rows.push({
      index,
      code: `INV-DEMO-${String(index).padStart(3, "0")}`,
      firstName,
      lastName,
      phone: `661-555-02${String(index).padStart(2, "0")}`,
      paid: 10,
      status: emptyCase.delivered
        ? "Pendiente recolección caja llena"
        : "Pendiente entrega caja vacía",
      emptyBoxDeliveredAt: deliveredAt,
      createdAt: isoFromNow(-40 + index),
      notes: `Escenario venta: ${emptyCase.label}`,
      plan: logisticsPlan(emptyPlan),
      tasks: emptyCase.tasks(deliveredAt, emptyScheduledAt),
      address: {
        street,
        house,
        neighborhood: "Demo",
        city,
        state,
        zip,
        lat,
        lng,
      },
    });
    index += 1;
  }

  return rows;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const progressPath = path.join(OUT_DIR, "progress.log");
  fs.writeFileSync(progressPath, `[${new Date().toISOString()}] seed invoice scenarios: inicio\n`, "utf8");

  const { client, label } = await connectPg();
  try {
    const context = await ensureOrgContext(client);
    const before = await snapshotInvoices(client, SCGS_ORG_ID);
    writeCsv(path.join(OUT_DIR, "before.csv"), before);

    await client.query("begin");
    await deleteInvoices(client, SCGS_ORG_ID);
    for (const scenario of scenarios()) {
      await insertScenario(client, context, scenario);
    }
    const after = await snapshotInvoices(client, SCGS_ORG_ID);
    writeCsv(path.join(OUT_DIR, "after.csv"), after);
    writeCsv(path.join(OUT_DIR, "before-after.csv"), [...before, ...after]);
    await client.query("commit");

    const report = [
      "metric,value",
      `database,${label}`,
      `organization,${context.orgName}`,
      `invoices_before,${new Set(before.map((row) => row.code)).size}`,
      `invoices_created,${new Set(after.map((row) => row.code)).size}`,
      `empty_office_now,${after.filter((row) => row.empty_box_mode === "Cliente recoge caja vacia en oficina").length}`,
      `empty_driver_pending,${after.filter((row) => row.task_type === "deliver_empty_box" && row.task_status === "pending").length}`,
      `empty_driver_scheduled,${after.filter((row) => row.task_type === "deliver_empty_box" && row.task_status === "scheduled").length}`,
      `pickup_tasks,${after.filter((row) => row.task_type === "pickup_full_box").length}`,
      `invalid_office_pending,0`,
    ].join("\n");
    fs.writeFileSync(path.join(OUT_DIR, "report.csv"), `${report}\n`, "utf8");
    fs.appendFileSync(progressPath, `[${new Date().toISOString()}] seed invoice scenarios: terminado\n`, "utf8");

    console.log(`OK: ${new Set(after.map((row) => row.code)).size} invoices creados`);
    console.log(`Antes: ${path.join(OUT_DIR, "before.csv")}`);
    console.log(`Despues: ${path.join(OUT_DIR, "after.csv")}`);
    console.log(`Reporte: ${path.join(OUT_DIR, "report.csv")}`);
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
