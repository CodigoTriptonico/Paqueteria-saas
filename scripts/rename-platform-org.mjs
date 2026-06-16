import { connectPg } from "./lib/db-connection.mjs";

const { client, label } = await connectPg();
console.log("Connected to", label);
const { rows } = await client.query(`
  update public.organizations
  set name = 'Boxario', slug = 'boxario'
  where kind = 'platform' or name ilike 'paquemas' or slug ilike 'paquemas'
  returning id, name, slug
`);
console.log("Organizaciones actualizadas:", rows);
await client.end();
