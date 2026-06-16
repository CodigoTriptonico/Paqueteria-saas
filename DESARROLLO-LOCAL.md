# Desarrollo local

La app usa Supabase local en Docker: Postgres + Auth en `127.0.0.1`.

## Requisitos

1. Docker Desktop instalado y corriendo.
2. Node.js 20+.

## Poner modo local

```powershell
npm run env:local
```

Eso escribe `.env.local` para usar `http://127.0.0.1:54321`.

## Arranque rapido

Doble clic en `INICIAR-DESARROLLO-LOCAL.bat`.

O terminal:

```powershell
npm run supabase:start
npm run db:apply
npm run dev
```

Login:

```text
http://localhost:3000/login
```

## Comandos utiles

| Comando | Descripcion |
| --- | --- |
| `npm run supabase:start` | Inicia Supabase local |
| `npm run supabase:stop` | Detiene Supabase local |
| `npm run supabase:status` | URLs y keys locales |
| `npm run db:apply` | Migraciones locales |
| `npm run db:local:reset` | Borra y recrea BD local |
| `npm run env:local` | Escribe `.env.local` local |

## Datos

- Los datos viven en Docker.
- Studio local aparece en `npm run supabase:status`.
- Postgres directo: `127.0.0.1:54322`, usuario `postgres`, password `postgres`.

## Si falla

- Revisa que Docker Desktop este abierto.
- Ejecuta `docker ps`.
- Confirma que `NEXT_PUBLIC_SUPABASE_URL` sea `http://127.0.0.1:54321`.
