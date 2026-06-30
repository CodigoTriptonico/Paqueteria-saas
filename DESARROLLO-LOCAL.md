# Desarrollo local

La app **solo** usa Supabase local en Docker (Postgres + Auth en `127.0.0.1`). No hay modo nube en este repo.

## Requisitos

1. Docker Desktop instalado y corriendo.
2. Node.js 20+.

## Arranque (un comando)

```powershell
npm run dev:up
```

Eso hace, en orden:

1. Comprueba que Docker responde.
2. Comprueba que `.env.local` coincide con `supabase/config.toml`.
3. Levanta Supabase si no responde (sin borrar datos).
4. Levanta Next.js si el puerto 3000 está libre.
5. Abre `http://localhost:3000` en el navegador.

Usa esto cada mañana. No hace falta recordar pasos sueltos.

## Configurar entorno (solo la primera vez o si cambias puertos)

```powershell
npm run env:local
```

## Arranque manual (si prefieres terminales separadas)

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
| `npm run dev:up` | Arranque completo con comprobaciones |
| `npm run supabase:start` | Inicia Supabase local |
| `npm run supabase:stop` | Detiene Supabase local |
| `npm run supabase:status` | URLs y keys locales (fuente de verdad de puertos) |
| `npm run db:apply` | Migraciones locales |
| `npm run db:restore-owner` | Crea dueño de plataforma local |
| `npm run db:local:reset` | Borra y recrea BD local |
| `npm run env:local` | Regenera `.env.local` local |

## Puertos

Definidos en `supabase/config.toml`. Valores actuales del proyecto:

| Servicio | Puerto |
| --- | --- |
| API / Auth | `54321` |
| Postgres | `54322` |
| Studio | `54323` |
| Mailpit | `54324` |

Postgres directo: `127.0.0.1:54322`, usuario `postgres`, password `postgres`.

Si cambias puertos en `config.toml`, ejecuta `npm run env:local` y revisa `npm run supabase:status`.

## Por que a veces falla al dia siguiente

Nada arranca solo al encender el PC:

- **Docker Desktop** puede estar abierto pero sin contenedores (Supabase parado desde ayer).
- **Next.js** no persiste: si cerraste la terminal o reiniciaste, el puerto 3000 queda vacio (`ERR_CONNECTION_REFUSED`).
- **Windows (Hyper-V)** reserva rangos de puertos que cambian; por eso migramos de `58021` a `54321`.
- **`.env.local` desincronizado** con `config.toml` produce errores de login aunque la app cargue.

`npm run dev:up` cubre esos cuatro casos antes de abrir el navegador.

## Si falla

- Docker Desktop abierto y `docker ps` responde.
- `NEXT_PUBLIC_SUPABASE_URL` en `.env.local` coincide con `npm run supabase:status`.
- Si un puerto no arranca en Windows: `netsh interface ipv4 show excludedportrange protocol=tcp`.
- No uses `supabase stop` salvo que quieras apagar la BD a propósito; los datos quedan en volumenes Docker.
