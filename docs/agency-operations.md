# Operación de agencias

## Resultado medible

La operación nueva debe conservar estas métricas en cero:

- movimientos duplicados por reintento;
- cantidades confirmadas sin responsable;
- diferencias de cantidad sin motivo;
- cajas propias consumiendo lotes de la matriz;
- acceso entre tenants o entre agencias hermanas.

## Solicitudes y visitas

Una agencia solicita líneas de servicio. La matriz confirma las cantidades y puede agrupar entrega de cajas vacías, recolección de cajas llenas y servicios a domicilio en una sola visita. Cada línea conserva cantidad solicitada, confirmada, diferencia, motivo, evidencia y membresía responsable.

La ruta operativa se guarda en la visita. Cambiarla no cambia la asignación predeterminada de la agencia. La asignación predeterminada tiene vigencia histórica y nunca se sobrescribe.

## Cajas por cantidades

Las cajas vacías entregadas por la matriz se registran en lotes por tipo y tamaño. No tienen QR ni identidad individual. Un envío declara una de dos fuentes:

- `matrix_purchased`: asigna cantidades FIFO contra lotes entregados;
- `own_box`: no consume ningún lote de la matriz.

El saldo y la antigüedad son analíticos. No crean cargos, multas ni ajustes automáticos. Un cargo por caja solo nace de una línea confirmada de entrega y de una tarifa explícita aplicada por la capa financiera.

## Atomicidad e idempotencia

`confirm_agency_visit` bloquea la visita y sus líneas, valida tenant, cantidades y permisos, y después registra todos los efectos en la misma transacción. La clave `(tenant_id, operation_type, idempotency_key)` devuelve el resultado guardado en reintentos. Si falla inventario, cargo o auditoría, no queda ningún efecto parcial.

## Fallos que el contrato impide

- Una visita sin líneas no puede confirmarse.
- Una cantidad negativa o fraccionaria no puede persistirse.
- Una diferencia sin motivo no puede confirmarse.
- Una visita confirmada no puede confirmarse otra vez con otra clave.
- Un usuario nunca aporta `tenant_id`; se deriva de su membresía activa.
- RLS exige coincidencia de `tenant_id` y `organization_id` o autoridad de matriz dentro del mismo tenant.
