# Boxario (paqueteria-saas)

SaaS local para paqueterias: inventario, ventas, clientes, envios, roles y panel plataforma.

## Requisitos

- Node.js 20+
- Docker Desktop

## Inicio local

```powershell
npm install
npm run env:local
npm run supabase:start
npm run db:apply
npm run db:restore-owner
npm run dev
```

Abre:

```text
http://localhost:3000/login
```

## Scripts

| Comando | Para que sirve |
| --- | --- |
| `npm run dev` | App local |
| `npm run build` | Compilar |
| `npm run lint` | Revisar codigo |
| `npm test` | Tests |
| `npm run supabase:start` | Levantar Supabase local |
| `npm run supabase:stop` | Apagar Supabase local |
| `npm run supabase:status` | Ver URLs/keys locales |
| `npm run db:apply` | Aplicar migraciones |
| `npm run db:check` | Revisar migraciones esperadas |
| `npm run db:restore-owner` | Crear dueño de plataforma local |
| `npm run db:inspect` | Inspeccionar tablas locales |
| `npm run db:list-users` | Listar usuarios locales |
| `npm run db:delete-users` | Borrar todos los usuarios y orgs (dev) |
| `npm run db:repair-plan-limits` | Reparar límites de plan (migración 015) |
| `npm run db:rename-platform-org` | Renombrar org plataforma a Boxario |
| `npm run db:add-box-sizes` | Añadir tamaños de caja al inventario |
| `npm run db:local:reset` | Resetear base local |
| `npm run codegen:dial-codes` | Regenerar `dial-codes-by-iso.ts` |
| `npm run test:platform-auth` | Probar flujo de auth de plataforma |
| `npm run test:sms` | Probar flujo SMS local |

## Arquitectura

- Next.js 16 App Router
- React 19
- Supabase local: Auth + Postgres + RLS
- Server Actions en `src/app/actions/`
- Auth global en `src/proxy.ts` (convención Proxy de Next 16; redirige a `/login` sin sesión)
- Permisos por ruta en layouts con `requirePathAccess()`
- Super-admin en `/platform`

## Envios

- `/envios`: vendedores gestionan ventas, estado operativo y seguimiento del cliente.
- Seguimiento por invoice en `shipment_contact_logs`: llamada/medio, resultado, nota, proximo paso y recordatorio.
- RLS: vendedor solo ve/escribe seguimiento de sus invoices; administrador ve todos.

## Docs

- Setup y pruebas: [SETUP.md](./SETUP.md)
- Docker, puertos y troubleshooting: [DESARROLLO-LOCAL.md](./DESARROLLO-LOCAL.md)
