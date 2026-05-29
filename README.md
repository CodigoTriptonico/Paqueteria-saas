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
| `npm run publish:online` | Sube a GitHub → Vercel actualiza el sitio online |

## Publicar cambios online (automatico)

El proyecto **ya esta conectado** a GitHub (`CodigoTriptonico/Paqueteria-saas`) y Vercel.

Cada vez que hagas **push** a la rama `main`, Vercel reconstruye y actualiza:

**https://paqueteria-saas.vercel.app**

### Interfaz grafica (recomendado)

Doble clic en el archivo:

**`PUBLICAR-EN-INTERNET.bat`**

(o ejecuta `npm run publish:gui`)

Botones:
1. **Probar en mi PC** — abre localhost
2. **PUBLICAR EN INTERNET** — sube todo y Vercel actualiza el link

### Flujo en terminal (opcional)

1. Editas codigo y pruebas en local: `npm run dev`
2. Cuando quieras publicar:

```powershell
npm run publish:online
```

O con mensaje de commit:

```powershell
npm run publish:online -- -Message "Arreglo inventario"
```

En 1-2 minutos el link online tiene la version nueva.

### Importante

- **No se sube solo al guardar el archivo** — hace falta `publish:online` (o `git push`).
- **`.env.local` no se sube** (secretos). Variables de produccion van en Vercel → Settings → Environment Variables.
- Cambios de **base de datos** (SQL) van aparte: `npm run db:apply` o SQL Editor en Supabase.

## Arquitectura

- **Next.js 16** (App Router) + **Supabase** (Auth + Postgres + RLS)
- Server Actions en `src/app/actions/`
- Proxy de sesión y guards por rol en `src/proxy.ts`
- Super-admin de plataforma en `/platform` (tabla `platform_admins`, ver SETUP.md §7)

## Sin Supabase

Sin `.env.local` con credenciales válidas, las pantallas de inventario y envíos muestran un aviso y listas vacías; no hay datos de demostración en la interfaz. Usa `npm run seed:demo` (con service role) para poblar la base de datos.
