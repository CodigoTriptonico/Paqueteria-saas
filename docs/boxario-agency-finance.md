# Finanzas de agencias Boxario

## Resultado medible

La migración `071_agency_finance_accounting.sql` hace verificables cuatro invariantes:

- cada fila financiera pertenece a un `tenant_id` y a organizaciones del mismo tenant;
- cada asiento tiene débitos iguales a créditos al confirmar la transacción;
- un reintento con la misma clave no duplica venta, cargo, pago ni conciliación;
- ningún paquete pasa a `handed_to_carrier` mientras conserve una retención vinculada activa.

La moneda inicial es USD y todo importe se guarda como entero en centavos. Los pagos de clientes de una agencia permanecen en su submayor y no generan ingreso de la matriz.

## Fuentes de verdad

Los cargos, pagos, aplicaciones, créditos, reversos, asientos, conciliaciones y eventos de retención son append-only. Sus estados se calculan en:

- `customer_invoice_balances` y `customer_payment_balances`;
- `agency_charge_balances` y `agency_payment_balances`;
- `current_financial_holds`.

Una corrección crea un evento compensatorio. No modifica el hecho original.

## RPC

Los comandos reciben un objeto JSON y una `idempotency_key` independiente. El tenant, la organización y la membresía se derivan de la sesión.

| RPC | Propósito |
|---|---|
| `create_agency_sale(command, idempotency_key)` | Crea venta, líneas, factura local, cargos internos, asientos y retenciones en una transacción. |
| `record_customer_payment(command, idempotency_key)` | Registra y aplica dinero del cliente dentro de la agencia. |
| `record_agency_payment(command, idempotency_key)` | Registra dinero recibido por la matriz y lo aplica a cargos internos. |
| `reconcile_driver_settlement(command, idempotency_key)` | Liquida custodia de efectivo y contabiliza diferencias. |
| `reverse_financial_event(command, idempotency_key)` | Revierte cargos, pagos de agencia o pagos de cliente con eventos enlazados. |
| `authorize_international_release(command, idempotency_key)` | Libera retenciones automáticamente por saldo cero o manualmente con evidencia. |

Todos devuelven `{ operationId, replayed, version, entities }`.

## Retenciones

Insertar un `agency_charge` con `shipment_id` o `package_id` crea una retención. Aplicar el saldo completo la libera automáticamente. Un reverso de aplicación vuelve a activarla. La liberación manual exige `financial_hold.release_manual`, motivo y evidencia. `financial_hold_policies.manual_release_requires_second_approval` está en `false` por defecto; al activarlo, el solicitante y el aprobador deben ser membresías distintas.

## Fallas deliberadas

- Una aplicación mayor al saldo del pago falla con `PAYMENT_OVERAPPLIED`.
- Una aplicación mayor al saldo del cargo o factura falla con `CHARGE_OVERAPPLIED` o `INVOICE_OVERAPPLIED`.
- Un asiento incompleto o desbalanceado revierte toda la transacción con `UNBALANCED_JOURNAL_ENTRY`.
- Una organización de otro tenant falla en los triggers de alcance antes de contabilizar.
- Un paquete retenido falla con `FINANCIAL_HOLD_ACTIVE`, incluso si la interfaz intenta omitir la validación.

Las tablas heredadas `distribution_partner_ledger`, `shipment_payments` y sus lecturas siguen intactas para compatibilidad durante la escritura dual y el corte posterior.
