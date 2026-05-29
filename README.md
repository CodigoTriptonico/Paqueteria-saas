# Paquemas (paqueteria-saas)

SaaS multiempresa para paqueterías: inventario por bodega, ventas con descuento de stock, roles/permisos y envíos para conductores.

## Requisitos

- Node.js 20+
- Proyecto [Supabase](https://supabase.com) (producción de datos y auth)

## Inicio rápido

```bash
npm install
cp .env.example .env.local
# Edita .env.local con tus keys de Supabase
npm run db:check
npm run dev
```

Guía detallada: [SETUP.md](./SETUP.md)

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run db:check` | Valida migraciones y tablas esperadas |

## Arquitectura

- **Next.js 16** (App Router) + **Supabase** (Auth + Postgres + RLS)
- Server Actions en `src/app/actions/`
- Middleware de sesión y guards por rol en `src/middleware.ts`
- Super-admin de plataforma en `/platform` (tabla `platform_admins`, ver SETUP.md §7)

## Sin Supabase

Sin `.env.local` con credenciales válidas, las pantallas de inventario y envíos muestran un aviso y listas vacías; no hay datos de demostración en la interfaz. Usa `npm run seed:demo` (con service role) para poblar la base de datos.
