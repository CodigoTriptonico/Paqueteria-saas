# Desarrollo local

La app **solo** usa Supabase local en Docker (Postgres + Auth en `127.0.0.1`). No hay modo nube en este repo.

## Requisitos

1. Docker Desktop instalado y corriendo.
2. Node.js 20+.

## Configurar entorno

```powershell
npm run env:local
```

Eso escribe `.env.local` con `http://127.0.0.1:55321` (puertos `55xxx` evitan bloqueos de Windows en el rango `543xx`).

## Arranque rapido

Doble clic en `INICIAR-DESARROLLO-LOCAL.bat`.

O terminal:

```powershell
npm run supabase:start
npm run db:apply
npm run db:restore-owner
npm run dev
```

Login: `http://localhost:3000/login`

## Comandos utiles

| Comando | Descripcion |
| --- | --- |
| `npm run supabase:start` | Inicia Supabase local |
| `npm run supabase:stop` | Detiene Supabase local |
| `npm run supabase:status` | URLs y keys locales |
| `npm run db:apply` | Migraciones locales |
| `npm run db:restore-owner` | Crea dueño de plataforma local |
| `npm run db:local:reset` | Borra y recrea BD local |
| `npm run env:local` | Regenera `.env.local` local |

## Puertos

| Servicio | Puerto |
| --- | --- |
| API / Auth | `55321` |
| Postgres | `55322` |
| Studio | `55323` |
| Mailpit | `55324` |

Postgres directo: `127.0.0.1:55322`, usuario `postgres`, password `postgres`.

## Si falla

- Docker Desktop abierto y `docker ps` responde.
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321` en `.env.local`.
- Si un puerto no arranca en Windows, revisa reservas: `netsh interface ipv4 show excludedportrange protocol=tcp`.
