/**
 * Agrega un destinatario en México a cada remitente SCGS que aún no tenga uno.
 * Uso: node scripts/seed-scgs-mexico-recipients.mjs
 */
import { connectPg } from "./lib/db-connection.mjs";

const SCGS_ORG_ID = "2029bf0c-e766-4840-9d90-f4b252cc3fe9";
const MEXICO_COUNTRY = "México";

const mexicoDestinations = [
  {
    first_name: "Rosa",
    last_name: "García",
    phone: "+52-33-3612-8840",
    street: "Av. Chapultepec",
    house_number: "245",
    neighborhood: "Americana",
    city: "Guadalajara",
    state: "Jalisco",
    postal_code: "44160",
  },
  {
    first_name: "Elena",
    last_name: "Vargas",
    phone: "+52-81-8345-2291",
    street: "Av. Constitución",
    house_number: "1520",
    neighborhood: "Centro",
    city: "Monterrey",
    state: "Nuevo León",
    postal_code: "64000",
  },
  {
    first_name: "Pedro",
    last_name: "Jiménez",
    phone: "+52-55-5512-4478",
    street: "Calle Insurgentes Sur",
    house_number: "892",
    neighborhood: "Del Valle",
    city: "Ciudad de México",
    state: "CDMX",
    postal_code: "03100",
  },
  {
    first_name: "Laura",
    last_name: "Morales",
    phone: "+52-222-312-5567",
    street: "Blvd. 5 de Mayo",
    house_number: "318",
    neighborhood: "La Paz",
    city: "Puebla",
    state: "Puebla",
    postal_code: "72160",
  },
  {
    first_name: "Ricardo",
    last_name: "Navarro",
    phone: "+52-477-712-9034",
    street: "Blvd. López Mateos",
    house_number: "2104",
    neighborhood: "Jardines del Moral",
    city: "León",
    state: "Guanajuato",
    postal_code: "37160",
  },
  {
    first_name: "Carmen",
    last_name: "Ortega",
    phone: "+52-664-382-1145",
    street: "Av. Revolución",
    house_number: "1450",
    neighborhood: "Zona Centro",
    city: "Tijuana",
    state: "Baja California",
    postal_code: "22000",
  },
  {
    first_name: "Alberto",
    last_name: "Ríos",
    phone: "+52-449-912-3380",
    street: "Av. Universidad",
    house_number: "702",
    neighborhood: "Barrio de la Estación",
    city: "Aguascalientes",
    state: "Aguascalientes",
    postal_code: "20130",
  },
  {
    first_name: "Verónica",
    last_name: "Salazar",
    phone: "+52-998-884-5521",
    street: "Av. Tulum",
    house_number: "88",
    neighborhood: "Supermanzana 62",
    city: "Cancún",
    state: "Quintana Roo",
    postal_code: "77525",
  },
  {
    first_name: "Héctor",
    last_name: "Mendoza",
    phone: "+52-442-215-6678",
    street: "Av. Corregidora Norte",
    house_number: "456",
    neighborhood: "Centro Histórico",
    city: "Querétaro",
    state: "Querétaro",
    postal_code: "76000",
  },
  {
    first_name: "Isabel",
    last_name: "Torres",
    phone: "+52-614-415-8890",
    street: "Av. Teófilo Borunda",
    house_number: "11230",
    neighborhood: "San Felipe",
    city: "Chihuahua",
    state: "Chihuahua",
    postal_code: "31203",
  },
];

function isMexicoCountry(country) {
  const normalized = country
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

  return normalized === "mexico";
}

function recipientForSender(sender, index) {
  const template = mexicoDestinations[index % mexicoDestinations.length];

  return {
    ...template,
    last_name: sender.last_name || template.last_name,
  };
}

const { client } = await connectPg();

try {
  const orgCheck = await client.query(
    "SELECT id, name FROM public.organizations WHERE id = $1",
    [SCGS_ORG_ID],
  );

  if (!orgCheck.rows.length) {
    console.error("No se encontró la org SCGS.");
    process.exit(1);
  }

  const senders = await client.query(
    `SELECT id, first_name, last_name, email
     FROM public.customers
     WHERE organization_id = $1
     ORDER BY created_at, last_name, first_name`,
    [SCGS_ORG_ID],
  );

  if (!senders.rows.length) {
    console.log("No hay remitentes. Ejecuta primero: node scripts/seed-scgs-senders.mjs");
    process.exit(0);
  }

  let inserted = 0;
  let skipped = 0;

  for (const [index, sender] of senders.rows.entries()) {
    const existing = await client.query(
      `SELECT id, country FROM public.customer_recipients
       WHERE customer_id = $1 AND organization_id = $2`,
      [sender.id, SCGS_ORG_ID],
    );

    const hasMexico = existing.rows.some((row) => isMexicoCountry(row.country));

    if (hasMexico) {
      skipped += 1;
      console.log(`Skip: ${sender.first_name} ${sender.last_name} (ya tiene destino México)`);
      continue;
    }

    const recipient = recipientForSender(sender, index);

    await client.query(
      `INSERT INTO public.customer_recipients (
        organization_id, customer_id,
        first_name, last_name, phone, country,
        street, house_number, neighborhood, city, state, postal_code
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        SCGS_ORG_ID,
        sender.id,
        recipient.first_name,
        recipient.last_name,
        recipient.phone,
        MEXICO_COUNTRY,
        recipient.street,
        recipient.house_number,
        recipient.neighborhood,
        recipient.city,
        recipient.state,
        recipient.postal_code,
      ],
    );

    inserted += 1;
    console.log(
      `OK: ${sender.first_name} ${sender.last_name} → ${recipient.first_name} ${recipient.last_name} (${recipient.city}, ${MEXICO_COUNTRY})`,
    );
  }

  const total = await client.query(
    `SELECT count(*)::int AS total
     FROM public.customer_recipients
     WHERE organization_id = $1
       AND lower(translate(country, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) = 'mexico'`,
    [SCGS_ORG_ID],
  );

  console.log(
    `\nInsertados: ${inserted}. Omitidos: ${skipped}. Destinatarios en México: ${total.rows[0].total}.`,
  );
} finally {
  await client.end();
}
