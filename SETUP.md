# Boxario - setup local

## 1. Requisitos

- Node.js 20+
- Docker Desktop corriendo

Puertos y variables: ver [DESARROLLO-LOCAL.md](./DESARROLLO-LOCAL.md).

## 2. Instalar

```powershell
npm install
npm run env:local
```

## 3. Base local

```powershell
npm run supabase:start
npm run db:apply
npm run db:restore-owner
```

Ver estado:

```powershell
npm run supabase:status
```

## 4. Arrancar app

```powershell
npm run dev
```

Abre:

```text
http://localhost:3000/login
```

## 5. Primera cuenta

- En `/login`, usa `Crear cuenta nueva`.
- Crea empresa + usuario administrador.
- Si quieres super-admin, define `PLATFORM_OWNER_EMAIL` en `.env.local` antes de registrar.

## 6. Roles

| Rol | Rutas esperadas |
| --- | --- |
| Administrador | Todo + Configuracion + Logistica |
| Vendedor | Inicio, Venta, Inventario |
| Conductor | Inicio, Envios |

Logistica (`/logistica`) es solo para administrador.

## 7. Pruebas manuales

Inventario:

1. Configuracion -> Inventario -> Bodegas.
2. Crear bodega o usar principal.
3. Revisar stock y movimientos.

Venta:

1. Completar venta.
2. Confirmar cobro.
3. Debe crear envio y descontar stock.

Envios:

1. Conductor solo ve envios asignados.
2. Puede cambiar estado.

## 8. Calidad

```powershell
npm test
npm run lint
npm run build
```

## Nota

Todo corre local. No hay hosting configurado en este flujo.
