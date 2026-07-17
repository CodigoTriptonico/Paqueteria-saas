# Modelo empresarial de Boxario

## Jerarquía

Boxario es la plataforma. Cada cliente, por ejemplo SCGS o Enviamgs, vive en `business_tenants`. Un tenant tiene una organización matriz y organizaciones agencia. `tenant_id` y `organization_id` forman la frontera de autorización; el código visible de la agencia nunca autoriza acceso.

Una identidad mantiene una sola `organization_membership` empresarial activa. Captadores, supervisores y soporte trabajan mediante asignaciones o delegaciones con vigencia, sin cambiar la organización de su perfil. Boxario puede actuar dentro de un tenant únicamente con una sesión de plataforma autenticada y cada acción queda auditada.

## Contratos permanentes

- Dinero: enteros en centavos y moneda `USD`.
- Mutaciones críticas: RPC transaccional e `idempotency_key` de 16 a 128 caracteres.
- Historia: asignaciones, estados, cargos, pagos, aplicaciones, asientos y auditoría no se editan ni borran. Se compensan con reversos.
- Venta de agencia: la factura y cartera del cliente pertenecen a la agencia. La matriz recibe solo cargos internos separados por concepto.
- Caja vacía: venta independiente. Los lotes se controlan por cantidad y FIFO, sin QR y sin cargos automáticos por antigüedad.
- Salida internacional: PostgreSQL rechaza `handed_to_carrier` mientras exista saldo en un cargo vinculado. La liberación manual requiere permiso, motivo y evidencia.

## RPC públicas

| RPC | Resultado medible |
|---|---|
| `transition_agency_status` | Una transición válida, versión optimista e historial |
| `assign_agency_captor` | Un captador activo y atribución anterior intacta |
| `assign_captor_supervisor` | Un supervisor activo y relación anterior intacta |
| `create_agency_sale` | Venta, líneas, factura, cargos, asientos y caja FIFO en una transacción |
| `confirm_agency_visit` | Cantidades confirmadas, inventario, cargos y evidencia sin efectos parciales |
| `record_customer_payment` | Pago de cliente aplicado solo dentro de su agencia |
| `record_agency_payment` | Pago matriz aplicado sin exceder cargos ni duplicarse |
| `reconcile_driver_settlement` | Efectivo en tránsito liquidado con diferencia explícita |
| `reverse_financial_event` | Evento compensatorio y asiento inverso enlazado |
| `authorize_international_release` | Salida autorizada solo sin saldo o con excepción auditada |

Todas devuelven `{ operationId, replayed, version, entities }`. El navegador no envía `tenant_id`; PostgreSQL lo deriva de la membresía activa.

## Compatibilidad y corte

Las tablas `distribution_*` permanecen como fuente histórica durante la transición. Las rutas antiguas redirigen permanentemente:

- `/distribuidores` → `/agencias`
- `/distribuidor` → `/agencia`
- `/mis-distribuidores` → `/captacion`

Las acciones antiguas de “eliminar” ahora archivan organizaciones y perfiles. Los datos históricos permanecen disponibles para auditoría. No se elimina ninguna tabla heredada en esta versión.

## Aplicación local

```powershell
npm.cmd run db:inspect
npm.cmd run db:apply
npm.cmd run db:check
npm.cmd run test:gate
npm.cmd run test:eval
npm.cmd run build
```

`db:apply` ejecuta 070–074 de forma aditiva. Antes del backfill local se guardó el snapshot `C:\tmp\boxario-business-migration\before.json`; la reconciliación quedó en `C:\tmp\boxario-business-migration\before-after.csv` y el informe en `C:\tmp\boxario-business-migration\report.md`. Para otro entorno, ejecutar primero una consulta de conteo y tamaño. Si el conjunto a modificar supera 100.000 filas o 100 MB, detenerse y pedir autorización antes de crear snapshot o backfill.

## Señales de control

La pantalla de Contabilidad expone las señales que deben permanecer en cero:

- `unbalancedJournalEntries`: asientos desbalanceados;
- retenciones liberadas con saldo vinculado;
- duplicados por reintento;
- cruces de tenant u organización;
- salidas internacionales con deuda vinculada.

También muestra pagos sin aplicar, efectivo de conductor en tránsito, cartera de agencias y retenciones activas para que lo pendiente sea visible sin convertirlo en “vencido”.
