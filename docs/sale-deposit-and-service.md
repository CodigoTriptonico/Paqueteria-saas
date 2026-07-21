# Venta: depósito y servicio de caja

## Resultado visible

- La factura de una venta de caja vacía imprime `Servicio de entrega`.
- La futura recolección de la caja llena es otro movimiento y no cambia la etiqueta de esa factura.
- La entrega estimada aparece en texto pequeño junto al país del destinatario, no en una franja propia.
- La confirmación de venta muestra un solo control: `Depósito pendiente`.
- Si el control está apagado, se registra el dinero recibido y su forma de pago.
- Si está encendido, se registra `$0` en caja y el depósito queda con estado `pending`.

## Estado financiero

El bloque `logistics_plan.billing` separa conceptos que antes compartían `payNow`:

- `depositRequired`: monto de depósito acordado, incluso si fue editado.
- `depositStatus`: `pending` o `paid`.
- `payNow`: dinero realmente registrado en la venta hasta ese momento.
- `balanceDue`: saldo total de la factura.

El dinero continúa respaldado por `shipments.paid` y `shipment_payments`. El estado no crea efectivo por sí solo.

## Cobro posterior

Al completar una tarea `deliver_empty_box`, el conductor solo ve el depósito faltante:

`min(depositRequired - paid, balanceDue)`

Si el depósito ya fue cubierto, la entrega no pide cobrar el resto de la factura. Si no se cobra, la tarea puede completarse y `depositStatus` permanece `pending`. Un cobro posterior se registra como `deposit` hasta cubrir `depositRequired`; los cobros siguientes son `balance`.
