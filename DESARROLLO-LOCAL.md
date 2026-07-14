# Desarrollo local

El desarrollo usa Supabase local en Docker (Postgres + Auth en `127.0.0.1`). La publicación a Vercel usa la configuración remota desde el flujo de publicación separado.

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

Login: `http://localhost:3000/login` — contraseña de todos los usuarios locales: `123456789`

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
| API / Auth | `55021` |
| Postgres | `55022` |
| Studio | `55023` |
| Mailpit | `55024` |

Postgres directo: `127.0.0.1:55022`, usuario `postgres`, password `postgres`.

Si cambias puertos en `config.toml`, ejecuta `npm run env:local` y revisa `npm run supabase:status`.

## Por que a veces falla al dia siguiente

Nada arranca solo al encender el PC:

- **Docker Desktop** puede estar abierto pero sin contenedores (Supabase parado desde ayer).
- **Next.js** no persiste: si cerraste la terminal o reiniciaste, el puerto 3000 queda vacio (`ERR_CONNECTION_REFUSED`).
- **Windows (Hyper-V)** reserva rangos de puertos que cambian; por eso migramos de `54321` a `55021`.
- **`.env.local` desincronizado** con `config.toml` produce errores de login aunque la app cargue.

`npm run dev:up` cubre esos cuatro casos antes de abrir el navegador.

## Google Maps (logística y direcciones)

En `.env.local` define ambas claves si quieres mapa en logística y autocomplete de direcciones:

- `GOOGLE_MAPS_API_KEY` — server (`/api/validate-address`, geocode)
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — cliente (panel de rutas en `/logistica`)

Sin la pública el mapa muestra aviso; sin la de server no validas direcciones.

## Si falla

- Docker Desktop abierto y `docker ps` responde.
- `NEXT_PUBLIC_SUPABASE_URL` en `.env.local` coincide con `npm run supabase:status`.
- Si un puerto no arranca en Windows: `netsh interface ipv4 show excludedportrange protocol=tcp`.
- No uses `supabase stop` salvo que quieras apagar la BD a propósito; los datos quedan en volumenes Docker.
