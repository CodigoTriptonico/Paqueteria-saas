# Paquemas — Configuración Supabase

## 1. Crear proyecto Supabase

1. Entra en [https://supabase.com/dashboard](https://supabase.com/dashboard) y crea un proyecto.
2. En **Project Settings → API**, copia:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (solo servidor, nunca en el cliente)

## 2. Variables de entorno

Copia `.env.example` a `.env.local` en la raíz del proyecto y pega tus valores:

```bash
cp .env.example .env.local
```

## 3. Auth

En Supabase → **Authentication → Providers**, habilita **Email** con contraseña.

## 4. Migraciones SQL

En **SQL Editor**, ejecuta en orden:

1. `supabase/migrations/001_roles_permissions_warehouses.sql`
2. `supabase/migrations/002_shipments.sql`
3. `supabase/migrations/003_platform_admin.sql`

Opcional: `supabase/seed-bootstrap.sql` si necesitas datos de referencia adicionales.

Verifica localmente:

```bash
npm run db:check
```

## 5. Arrancar la app

```bash
npm install
npm run dev
```

Abre [http://localhost:3000/login](http://localhost:3000/login).

- **Primera cuenta:** usa “Crear cuenta nueva” (registra empresa + usuario administrador vía `bootstrap_organization`).
- **Usuarios extra:** Configuración → Usuarios (requiere rol administrador).

## 6. Prueba manual por rol

| Rol | Rutas esperadas |
|-----|-----------------|
| Administrador | Todo + Configuración |
| Vendedor | Inicio, Venta, Inventario |
| Conductor | Inicio, Envíos (solo asignados, cambio de estado) |

### Inventario

1. Configuración → Inventario → Bodegas: activar multi-bodega, crear bodega, copiar catálogo.
2. Inventario: selector de bodega, stock y tabla de movimientos.
3. Los datos se guardan solo en Postgres (Supabase).

### Venta

1. Completar venta hasta **Confirmar cobro**.
2. Debe registrarse movimiento `salida` en inventario (requiere item de caja con stock en la bodega principal).

### Envíos

1. Conductor: solo ve envíos con `assigned_to` = su usuario.
2. Cambiar estado en el selector de cada tarjeta.

## 7. Super-admin de plataforma (dueño del SaaS)

Dos niveles separados:

| Nivel | Quién | Rutas |
|-------|--------|--------|
| Admin de empresa | Rol `administrador` dentro de una paquetería | `/configuracion`, inventario, etc. (solo su `organization_id`) |
| Admin de plataforma | Fila en `platform_admins` | `/platform` (todas las empresas) |

### Cómo convertirte en super-admin

**Opción A — al crear tu cuenta**

1. En `.env.local` define `PLATFORM_OWNER_EMAIL=tu@correo.com` (mismo email que usarás al registrarte).
2. Reinicia `npm run dev`.
3. En `/login` → “Crear cuenta nueva”. Tras el registro quedarás en `platform_admins`.

**Opción B — SQL manual (cuenta ya existente)**

En Supabase SQL Editor (sustituye el UUID por el de `auth.users`):

```sql
select public.grant_platform_admin('00000000-0000-0000-0000-000000000000');
```

O:

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'tu@correo.com'
on conflict do nothing;
```

### Panel `/platform`

- Lista todas las paqueterías (`organizations`): nombre, slug, activa, conteos de usuarios y bodegas.
- Crear paquetería nueva (org + usuario administrador inicial).
- Ver usuarios por empresa, crear usuarios, activar/desactivar empresa y usuarios.
- En el menú lateral aparece **Plataforma** solo si eres super-admin.

La **Configuración** habitual sigue limitada a la empresa de tu perfil (no es panel “dios”).

### Prueba rápida

1. Promoción a platform admin (opción A o B).
2. Inicia sesión → menú **Plataforma** → crear segunda empresa de prueba.
3. Cierra sesión e inicia con el admin de esa empresa: no debe ver `/platform`.
4. Ese admin solo ve datos de su org en Configuración e Inventario.

## 8. Calidad

```bash
npm run lint
npm run build
```

## Único bloqueo externo

Sin proyecto Supabase y las variables en `.env.local`, la app muestra avisos y listas vacías (sin datos inventados). Para el SaaS multiempresa completo necesitas credenciales reales del dashboard de Supabase.
