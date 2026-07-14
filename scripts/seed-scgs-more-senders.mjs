/**
 * Inserta remitentes demo adicionales con destinatarios aleatorios por país.
 * Uso: node scripts/seed-scgs-more-senders.mjs
 */
import { connectPg } from "./lib/db-connection.mjs";
import {
  SCGS_ORG_ID,
  isSameCountry,
  pickRandomRecipientCountries,
  recipientForSenderRandom,
} from "./lib/scgs-demo-recipients.mjs";

const MORE_SENDERS = [
  {
    first_name: "Daniel",
    last_name: "Castillo",
    phones: ["+1-661-251-1101"],
    email: "demo.more.01@boxario.local",
    street: "Canyon View Dr",
    house_number: "26201",
    neighborhood: "Canyon Country",
    city: "Santa Clarita",
    state: "CA",
    postal_code: "91351",
  },
  {
    first_name: "Elena",
    last_name: "Ruiz",
    phones: ["+1-661-252-2202"],
    email: "demo.more.02@boxario.local",
    street: "Copper Hill Dr",
    house_number: "28140",
    neighborhood: "Valencia",
    city: "Santa Clarita",
    state: "CA",
    postal_code: "91354",
  },
  {
    first_name: "Gabriel",
    last_name: "Vega",
    phones: ["+1-661-253-3303"],
    email: "demo.more.03@boxario.local",
    street: "Decoro Dr",
    house_number: "27550",
    neighborhood: "Saugus",
    city: "Santa Clarita",
    state: "CA",
    postal_code: "91350",
  },
  {
    first_name: "Helena",
    last_name: "Paredes",
    phones: ["+1-661-254-4404"],
    email: "demo.more.04@boxario.local",
    street: "Davenport Rd",
    house_number: "22980",
    neighborhood: "Newhall",
    city: "Santa Clarita",
    state: "CA",
    postal_code: "91321",
  },
  {
    first_name: "Iván",
    last_name: "Delgado",
    phones: ["+1-661-255-5505"],
    email: "demo.more.05@boxario.local",
    street: "Golden Valley Rd",
    house_number: "27680",
    neighborhood: "Santa Clarita",
    city: "Santa Clarita",
    state: "CA",
    postal_code: "91350",
  },
  {
    first_name: "Julia",
    last_name: "Acosta",
    phones: ["+1-661-256-6606"],
    email: "demo.more.06@boxario.local",
    street: "Hasley Canyon Rd",
    house_number: "25100",
    neighborhood: "Castaic",
    city: "Santa Clarita",
    state: "CA",
    postal_code: "91384",
  },
  {
    first_name: "Kevin",
    last_name: "Fuentes",
    phones: ["+1-661-257-7707"],
    email: "demo.more.07@boxario.local",
    street: "Henry Mayo Dr",
    house_number: "23880",
    neighborhood: "Newhall",
    city: "Santa Clarita",
    state: "CA",
    postal_code: "91355",
  },
  {
    first_name: "Laura",
    last_name: "Ibáñez",
    phones: ["+1-661-258-8808"],
    email: "demo.more.08@boxario.local",
    street: "Iron Canyon Rd",
    house_number: "26420",
    neighborhood: "Canyon Country",
    city: "Santa Clarita",
    state: "CA",
    postal_code: "91387",
  },
  {
    first_name: "Marcos",
    last_name: "León",
    phones: ["+1-661-259-9909"],
    email: "demo.more.09@boxario.local",
    street: "Jasmine Ct",
    house_number: "24210",
    neighborhood: "Valencia",
    city: "Santa Clarita",
    state: "CA",
    postal_code: "91355",
  },
  {
    first_name: "Natalia",
    last_name: "Ochoa",
    phones: ["+1-661-260-1010"],
    email: "demo.more.10@boxario.local",
    street: "Kirkland Ave",
    house_number: "23340",
    neighborhood: "Newhall",
    city: "Santa Clarita",
    state: "CA",
    postal_code: "91321",
  },
  {
    first_name: "Óscar",
    last_name: "Peña",
    phones: ["+1-661-261-1111"],
    email: "demo.more.11@boxario.local",
    street: "Larkspur Dr",
    house_number: "28760",
    neighborhood: "Saugus",
    city: "Santa Clarita",
    state: "CA",
    postal_code: "91350",
  },
  {
    first_name: "Paula",
    last_name: "Quintana",
    phones: ["+1-661-262-1212"],
    email: "demo.more.12@boxario.local",
    street: "Meadowlark Dr",
    house_number: "26890",
    neighborhood: "Canyon Country",
    city: "Santa Clarita",
    state: "CA",
    postal_code: "91351",
  },
];

async function insertSender(client, sender) {
  const exists = await client.query(
    `SELECT id FROM public.customers
     WHERE organization_id = $1
       AND lower(email) = lower($2)`,
    [SCGS_ORG_ID, sender.email],
  );

  if (exists.rows.length) {
    return { senderId: exists.rows[0].id, created: false };
  }

  const inserted = await client.query(
    `INSERT INTO public.customers (
      organization_id, first_name, last_name, phones, email,
      street, house_number, neighborhood, city, state, postal_code, country
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'USA')
    RETURNING id`,
    [
      SCGS_ORG_ID,
      sender.first_name,
      sender.last_name,
      sender.phones,
      sender.email,
      sender.street,
      sender.house_number,
      sender.neighborhood,
      sender.city,
      sender.state,
      sender.postal_code,
    ],
  );

  return { senderId: inserted.rows[0].id, created: true };
}

async function insertRecipientsForSender(client, senderRecord, random = Math.random) {
  const existing = await client.query(
    `SELECT country FROM public.customer_recipients
     WHERE customer_id = $1 AND organization_id = $2`,
    [senderRecord.id, SCGS_ORG_ID],
  );

  const existingCountries = existing.rows.map((row) => row.country);
  const selectedCountries = pickRandomRecipientCountries(random);
  let inserted = 0;
  let skipped = 0;

  for (const country of selectedCountries) {
    const alreadyHasCountry = existingCountries.some((name) =>
      isSameCountry(name, country.name),
    );

    if (alreadyHasCountry) {
      skipped += 1;
      continue;
    }

    const recipient = recipientForSenderRandom(senderRecord, country.name, random);
    if (!recipient) {
      skipped += 1;
      continue;
    }

    await client.query(
      `INSERT INTO public.customer_recipients (
        organization_id, customer_id,
        first_name, last_name, phone, country,
        street, house_number, neighborhood, city, state, postal_code
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        SCGS_ORG_ID,
        senderRecord.id,
        recipient.first_name,
        recipient.last_name,
        recipient.phone,
        country.name,
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
      `  → ${recipient.first_name} ${recipient.last_name} (${country.name})`,
    );
  }

  return { inserted, skipped };
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

  console.log(`Sembrando remitentes extra para: ${orgCheck.rows[0].name}\n`);

  await client.query("BEGIN");

  let sendersCreated = 0;
  let sendersSkipped = 0;
  let recipientsInserted = 0;
  let recipientsSkipped = 0;

  for (const sender of MORE_SENDERS) {
    const { senderId, created } = await insertSender(client, sender);

    if (created) {
      sendersCreated += 1;
      console.log(`OK remitente: ${sender.first_name} ${sender.last_name}`);
    } else {
      sendersSkipped += 1;
      console.log(`Skip remitente: ${sender.first_name} ${sender.last_name} (ya existe)`);
    }

    const senderRecord = {
      id: senderId,
      first_name: sender.first_name,
      last_name: sender.last_name,
    };

    const result = await insertRecipientsForSender(client, senderRecord);
    recipientsInserted += result.inserted;
    recipientsSkipped += result.skipped;
  }

  await client.query("COMMIT");

  const total = await client.query(
    `SELECT
       (SELECT count(*)::int FROM public.customers WHERE organization_id = $1) AS senders,
       (SELECT count(*)::int FROM public.customer_recipients WHERE organization_id = $1) AS recipients`,
    [SCGS_ORG_ID],
  );

  console.log("\n--- Resumen ---");
  console.log(`Remitentes nuevos: ${sendersCreated} (omitidos: ${sendersSkipped})`);
  console.log(`Destinatarios nuevos: ${recipientsInserted} (omitidos: ${recipientsSkipped})`);
  console.log(`Total remitentes SCGS: ${total.rows[0].senders}`);
  console.log(`Total destinatarios SCGS: ${total.rows[0].recipients}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
