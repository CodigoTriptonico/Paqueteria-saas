# Base de datos 100% local

Boxario guarda datos en PostgreSQL y el login en Supabase Auth.

En local eso significa: Supabase en Docker.

## Necesitas

1. Docker Desktop.
2. WSL actualizado.
3. Node.js 20+.

Si Docker pide actualizar WSL:

1. Clic derecho en `ARREGLAR-WSL.bat`.
2. Ejecutar como administrador.
3. Reiniciar PC.
4. Abrir Docker Desktop.

## Arrancar local

```powershell
npm run env:local
npm run supabase:start
npm run db:apply
npm run dev
```

## URLs locales

- App: `http://localhost:3000/login`
- Supabase API/Auth: `http://127.0.0.1:54321`
- Postgres: `127.0.0.1:54322`
- Usuario DB: `postgres`
- Password DB: `postgres`

Para ver Studio local:

```powershell
npm run supabase:status
```

## Nota

Instalar solo PostgreSQL en Windows no alcanza.

La app necesita Supabase Auth y tablas `auth.*`, por eso se usa Supabase local.
