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
| `npm run db:local:reset` | Resetear base local |

## Arquitectura

- Next.js 16 App Router
- React 19
- Supabase local: Auth + Postgres + RLS
- Server Actions en `src/app/actions/`
- Guards de sesion en `src/proxy.ts`
- Super-admin en `/platform`

## Docs

- Setup local: [SETUP.md](./SETUP.md)
- Base local: [DESARROLLO-LOCAL.md](./DESARROLLO-LOCAL.md)
