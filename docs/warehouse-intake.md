# Ingreso a bodega

## Resultado operativo

El ingreso formal responde cuatro preguntas sin depender de una hoja externa:

1. Qué cajas esperaba el camión.
2. Qué cajas fueron escaneadas físicamente.
3. Quién aceptó la custodia, cuándo y en qué ubicación quedaron.
4. Qué faltantes, sobrantes, daños o diferencias siguen abiertos.

La descarga no transfiere custodia por sí sola. Una caja permanece bajo responsabilidad del conductor hasta que `scan_warehouse_intake_package` la acepta. La recepción física tampoco elimina bloqueos de pago o documentación.

## Flujo

1. Una recolección completa mueve las cajas a `in_truck` y las vincula a ruta, tarea y conductor.
2. El conductor toca `Llegué a bodega`, elige la bodega real y una razón. La confirmación registra `truck_arrived_at` sin transferir custodia.
3. `open_warehouse_intake` crea `ING-000001`, congela el manifiesto esperado y marca la hora de descarga sin cambiar la custodia.
4. Cada lectura usa `scan_warehouse_intake_package` dentro de una transacción con bloqueo de fila e idempotencia.
5. La caja aceptada pasa a `warehouse_intake`, registra encargado, peso, condición, bodega y ubicación.
6. `close_warehouse_intake` calcula el resumen y cierra como `completed` o `completed_with_exceptions`.
7. `reopen_warehouse_intake` requiere `settings.manage`, motivo y evento auditado. Nunca borra el cierre ni las lecturas anteriores.

Estados de la sesión:

- `unloading`: manifiesto abierto y cajas por escanear.
- `in_review`: todas las esperadas ya se escanearon; todavía puede documentarse una diferencia antes del cierre.
- `completed`: conciliación sin diferencias.
- `completed_with_exceptions`: cierre operativo con diferencias abiertas.
- `cancelled`: reservado para una cancelación auditada futura. No existe borrado silencioso.

## Reglas por caja

- Un código repetido dentro del mismo ingreso se rechaza.
- Un reintento con la misma `operation_key` devuelve el resultado original.
- Una caja de otra ruta puede recibirse físicamente, pero queda como `unexpected` en Cuarentena.
- Un código inexistente queda como `unidentified`, con nota y foto obligatorias.
- Cualquier condición distinta de `correct` exige nota, foto y Cuarentena.
- Una diferencia sobre `organizations.settings.warehouse_weight_tolerance_kg` exige nota, bloquea liberación y abre una excepción de peso.
- Un pago pendiente se muestra como alerta, pero no impide aceptar la custodia física.
- Una ubicación configurada en `warehouse_bins` solo puede usarse si pertenece a la bodega del ingreso.

Condiciones físicas disponibles: correcta, abierta, golpeada, mojada, rota, mal sellada, etiqueta ilegible, contenido expuesto y no identificada.

## Cierre y conciliación

El cierre guarda una instantánea con:

- esperadas;
- recibidas;
- faltantes;
- sobrantes;
- dañadas;
- no identificadas;
- diferencias de peso fuera de tolerancia;
- cajas en Cuarentena.

El encargado siempre debe confirmar. El conductor confirma la cantidad entregada o el encargado escribe por qué no pudo hacerlo. Las diferencias no detienen toda la operación: el ingreso se cierra con excepciones abiertas y cada caja conserva su traza.

## Permisos y aislamiento

- Abrir, escanear y cerrar: `warehouses.manage` o `sales.manage`, más acceso explícito a la bodega.
- Reabrir: `settings.manage`.
- Lecturas, bins, manifiestos y sesiones se filtran por organización y bodega.
- `warehouse_intake_items`, `warehouse_intake_expected_packages` y `warehouse_intake_events` son append-only.
- Las fotos viven en el bucket privado `warehouse-intake-evidence`, separadas por organización.

## Operación móvil

- El escáner acepta `Enter`: desde código mueve al peso y desde peso confirma.
- Después de una recepción, el foco vuelve al código sin expandir listas ni mover la pantalla.
- Pendientes, ingresadas, diferencias e historial se abren como panel superpuesto.
- Los errores permanecen junto al escáner e incluyen `Intentar otra vez`.
- La cámara usa `capture="environment"` para documentar daños desde el celular.

Este módulo no promete operación sin conexión. Si se pierde la red, la lectura queda visible en el formulario y se reintenta manualmente; no se confirma localmente una transferencia de custodia que el servidor todavía no aceptó.

## Verificación

```powershell
npx.cmd tsx --test src/lib/warehouse-intake.test.ts
npx.cmd tsx --test src/lib/warehouse-intake.eval.test.ts
npm.cmd run db:check
npm.cmd run db:apply
npm.cmd run test:warehouse-db
npm.cmd run test:route-arrival-db
```

La prueba de base de datos usa una transacción local y termina con `ROLLBACK`.
