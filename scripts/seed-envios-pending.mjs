/**
 * Demo local: 20 invoices pendientes en envíos (10 por dejar, 10 por recoger).
 * Uso: node scripts/seed-envios-pending.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { connectPg } from "./lib/db-connection.mjs";

const SCGS_ORG_ID = process.env.SCGS_ORG_ID || "2029bf0c-e766-4840-9d90-f4b252cc3fe9";
const OUT_DIR = "/tmp/boxario-envios-pending";
const COUNT_PER_BUCKET = 10;
const BOX_LABELS = ["14x14x14", "16x16x16", "18x18x18"];

function isoFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(filePath, rows) {
  const headers = ["code", "customer_name", "status", "bucket"];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function recipientSnapshot(row) {
  return {
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
    city: row.recipient_city,
    phone: row.recipient_phone,
    state: row.recipient_state,
    street: row.recipient_street,
    country: row.recipient_country,
    placeId: "",
    lastName: row.recipient_last,
    firstName: row.recipient_first,
    postalCode: row.recipient_postal,
    houseNumber: row.recipient_house,
    neighborhood: row.recipient_neighborhood,
    formattedAddress: "",
  };
}

function emptyBoxDeliveryPlan(boxLabel, warehouseId) {
  return {
    box: { cost: "$31", paid: "$50", time: "3-5 dias", label: boxLabel, carrier: "" },
    fees: { total: "$0", fullBoxPickup: "$0", emptyBoxDelivery: "$0" },
    notes: "",
    billing: {
      payNow: "$0",
      boxCount: 1,
      balanceDue: "$50",
      boxSubtotal: "$50",
      quotedTotal: "$50",
      boxUnitPrice: "$50",
      fullBoxPickup: "$0",
      minimumDeposit: "$20",
      emptyBoxDelivery: "$0",
      logisticsFeeMode: "per_trip",
      logisticsSubtotal: "$0",
      promotionDiscount: "$0",
      boxSubtotalBeforeDiscount: "$50",
      promotionSelectionRequired: false,
      promotionCandidates: [],
      cartLines: [
        {
          time: "3-5 dias",
          label: boxLabel,
          carrier: "",
          quantity: 1,
          unitCost: "$31",
          unitPrice: "$50",
          catalogKey: `cajas|${boxLabel}|`,
        },
      ],
      promotion: null,
    },
    fullBox: {
      mode: "",
      label: "full_box",
      deferred: true,
      scheduleAt: null,
      scheduleMode: null,
      driverTaskType: null,
      driverTaskNeeded: false,
    },
    summary: "Caja vacia: Programar entrega de caja vacia - pendiente | Caja llena: Recolección pendiente",
    boxCount: 1,
    boxLines: [
      {
        cost: "$31",
        paid: "$50",
        time: "3-5 dias",
        label: boxLabel,
        carrier: "",
        quantity: 1,
        catalogKey: `cajas|${boxLabel}|`,
      },
    ],
    emptyBox: {
      mode: "Programar entrega de caja vacia",
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

function fullBoxPickupPlan(boxLabel, warehouseId, deliveredAt) {
  return {
    box: { cost: "$31", paid: "$50", time: "5-8 dias", label: boxLabel, carrier: "" },
    fees: { total: "$0", fullBoxPickup: "$0", emptyBoxDelivery: "$0" },
    notes: "",
    billing: {
      payNow: "$0",
      boxCount: 1,
      balanceDue: "$50",
      boxSubtotal: "$50",
      quotedTotal: "$50",
      boxUnitPrice: "$50",
      fullBoxPickup: "$0",
      minimumDeposit: "$20",
      emptyBoxDelivery: "$0",
      logisticsFeeMode: "per_trip",
      logisticsSubtotal: "$0",
      promotionDiscount: "$0",
      boxSubtotalBeforeDiscount: "$50",
      promotionSelectionRequired: false,
      promotionCandidates: [],
      cartLines: [
        {
          time: "5-8 dias",
          label: boxLabel,
          carrier: "",
          quantity: 1,
          unitCost: "$31",
          unitPrice: "$50",
          catalogKey: `cajas|${boxLabel}|`,
        },
      ],
      promotion: null,
    },
    fullBox: {
      mode: "",
      label: "full_box",
      deferred: true,
      scheduleAt: null,
      scheduleMode: null,
      driverTaskType: null,
      driverTaskNeeded: false,
    },
    summary: "Caja vacia: Caja vacia entregada en mostrador | Caja llena: Recolección pendiente",
    boxCount: 1,
    boxLines: [
      {
        cost: "$31",
        paid: "$50",
        time: "5-8 dias",
        label: boxLabel,
        carrier: "",
        quantity: 1,
        catalogKey: `cajas|${boxLabel}|`,
      },
    ],
    emptyBox: {
      mode: "Cliente recoge caja vacia en oficina",
      label: "empty_box",
      handingNow: true,
      scheduleAt: null,
      warehouseId,
      scheduleMode: null,
      driverTaskType: null,
      stockDeductedAt: deliveredAt,
      driverTaskNeeded: false,
    },
    driverTaskCount: 0,
  };
}

async function ensureOrgContext(client) {
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
    ownerId: owner.rows[0].id,
    warehouseId: warehouse.rows[0]?.id ?? null,
  };
}

async function loadCustomerRecipients(client) {
  const { rows } = await client.query(
    `
      select
        c.id as customer_id,
        c.first_name,
        c.last_name,
        c.lat,
        c.lng,
        r.id as recipient_id,
        r.first_name as recipient_first,
        r.last_name as recipient_last,
        r.country as recipient_country,
        r.street as recipient_street,
        r.house_number as recipient_house,
        r.neighborhood as recipient_neighborhood,
        r.city as recipient_city,
        r.state as recipient_state,
        r.postal_code as recipient_postal,
        r.phone as recipient_phone
      from public.customers c
      join public.customer_recipients r on r.customer_id = c.id
      where c.organization_id = $1
      order by c.created_at, r.created_at
    `,
    [SCGS_ORG_ID],
  );

  if (rows.length < COUNT_PER_BUCKET * 2) {
    throw new Error(`Se necesitan al menos ${COUNT_PER_BUCKET * 2} destinatarios; hay ${rows.length}.`);
  }

  return rows;
}

async function nextInvoiceNumber(client) {
  const { rows } = await client.query(
    "select public.next_organization_invoice_number($1) as last_number",
    [SCGS_ORG_ID],
  );

  return `INV-${String(rows[0].last_number).padStart(6, "0")}`;
}

async function insertShipment(client, context, row, bucket, index) {
  const code = await nextInvoiceNumber(client);
  const boxLabel = BOX_LABELS[index % BOX_LABELS.length];
  const customerName = `${row.first_name} ${row.last_name}`;
  const snapshot = recipientSnapshot(row);
  const isDelivery = bucket === "dejar";
  const deliveredAt = isDelivery ? null : isoFromNow(-24 - index);
  const plan = isDelivery
    ? emptyBoxDeliveryPlan(boxLabel, context.warehouseId)
    : fullBoxPickupPlan(boxLabel, context.warehouseId, deliveredAt);
  const status = isDelivery
    ? "Pendiente entrega caja vacía"
    : "Pendiente recolección caja llena";
  const deliveryNotes = plan.summary;

  await client.query(
    `
      insert into public.shipments (
        organization_id, code, customer_id, recipient_id, recipient_snapshot, customer_name, country,
        carrier, paid, profit, status, assigned_to, created_by, sales_owner_id, sale_kind,
        invoice_status, accounting_status, finalized_at, empty_box_delivered_at,
        full_box_collected_at, office_received_at, departed_at, shipped_at, delivered_at,
        delivery_notes, logistics_plan, created_at
      )
      values (
        $1,$2,$3,$4,$5,$6,$7,$8,0,0,$9,null,$10,$10,'full',
        'open','not_exportable',null,$11,null,null,null,null,null,$12,$13,$14
      )
    `,
    [
      SCGS_ORG_ID,
      code,
      row.customer_id,
      row.recipient_id,
      JSON.stringify(snapshot),
      customerName,
      row.recipient_country,
      `(1) ${boxLabel}`,
      status,
      context.ownerId,
      deliveredAt,
      deliveryNotes,
      JSON.stringify(plan),
      isoFromNow(-72 + index),
    ],
  );

  return {
    code,
    customer_name: customerName,
    status,
    bucket: isDelivery ? "por_dejar" : "por_recoger",
  };
}

async function snapshotPending(client) {
  const { rows } = await client.query(
    `
      select code, customer_name, status
      from public.shipments
      where organization_id = $1
        and status in ('Pendiente entrega caja vacía', 'Pendiente recolección caja llena')
      order by created_at, code
    `,
    [SCGS_ORG_ID],
  );

  return rows;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const progressPath = path.join(OUT_DIR, "progress.log");
  fs.writeFileSync(progressPath, `[${new Date().toISOString()}] seed envios pending: inicio\n`, "utf8");

  const { client, label } = await connectPg();
  try {
    const context = await ensureOrgContext(client);
    const recipients = await loadCustomerRecipients(client);
    const before = await snapshotPending(client);
    writeCsv(path.join(OUT_DIR, "before.csv"), before.map((row) => ({
      ...row,
      bucket: row.status === "Pendiente entrega caja vacía" ? "por_dejar" : "por_recoger",
    })));

    await client.query("begin");
    const created = [];

    for (let index = 0; index < COUNT_PER_BUCKET; index += 1) {
      created.push(
        await insertShipment(client, context, recipients[index], "dejar", index),
      );
    }

    for (let index = 0; index < COUNT_PER_BUCKET; index += 1) {
      created.push(
        await insertShipment(
          client,
          context,
          recipients[COUNT_PER_BUCKET + index],
          "recoger",
          index,
        ),
      );
    }

    const after = await snapshotPending(client);
    writeCsv(path.join(OUT_DIR, "after.csv"), after.map((row) => ({
      ...row,
      bucket: row.status === "Pendiente entrega caja vacía" ? "por_dejar" : "por_recoger",
    })));

    await client.query("commit");

    const porDejar = after.filter((row) => row.status === "Pendiente entrega caja vacía").length;
    const porRecoger = after.filter((row) => row.status === "Pendiente recolección caja llena").length;
    const report = [
      "metric,value",
      `database,${label}`,
      `created_this_run,${created.length}`,
      `pending_por_dejar,${porDejar}`,
      `pending_por_recoger,${porRecoger}`,
      `pending_total,${after.length}`,
    ].join("\n");
    fs.writeFileSync(path.join(OUT_DIR, "report.csv"), `${report}\n`, "utf8");
    fs.appendFileSync(progressPath, `[${new Date().toISOString()}] seed envios pending: terminado\n`, "utf8");

    console.log(`OK: ${created.length} invoices creados (${COUNT_PER_BUCKET} por dejar, ${COUNT_PER_BUCKET} por recoger)`);
    console.log(`Pendientes totales: ${after.length} (${porDejar} por dejar, ${porRecoger} por recoger)`);
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
