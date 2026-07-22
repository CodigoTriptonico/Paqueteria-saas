# Venta: depósito y servicio de caja

## Resultado visible

- La factura de una venta de caja vacía imprime `Servicio de entrega`.
- La futura recolección de la caja llena es otro movimiento y no cambia la etiqueta de esa factura.
- La entrega estimada aparece en texto pequeño junto al país del destinatario, no en una franja propia.
- La confirmación de venta muestra un solo control: `Depósito pagado`, marcado por defecto.
- Si el control está marcado, se registra el dinero recibido y su forma de pago.
- Si se desmarca, se registra `$0` en caja y el depósito queda con estado `pending`.

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

## Venta rápida de caja vacía

La entrega se decide con lenguaje de mostrador: `Entregar ahora` significa que el vendedor entrega la caja vacía en ese momento; `Programar ruta` abre el calendario operativo de Logística. El vendedor elige primero un día habilitado y después una ruta de ese día; el conductor predeterminado se resuelve desde la configuración semanal de Rutas. Si todavía no se conoce la ruta, se conserva el día solicitado y la tarea queda pendiente para que Logística la complete. La venta crea una tarea `deliver_empty_box` y, cuando ya existe una ruta concreta, solicita su asignación después de crear el invoice.

El primer panel muestra `Total de cajas`; ese importe es mercancía, no depósito. El depósito se calcula usando el mínimo configurado y el total real del invoice. `Depósito pagado` está marcado por defecto tanto en Venta normal como en Venta rápida; desmarcarlo conserva el monto exigido como pendiente, pero no registra entrada de efectivo. El catálogo rápido usa el país preferido cuando tiene cajas con precio; si no existe, usa el primer catálogo configurado con cajas. País, promociones e invoice conservan esa misma selección.

La caja se elige con tarjetas visibles, no con el selector nativo del sistema. Cada tarjeta mantiene la misma lectura de producto de la venta completa: icono de caja, medida, tiempo o descripción y precio de cobro. Igual que en el catálogo normal, el clic izquierdo suma unidades y muestra el distintivo amarillo `×1`, `×2`, `×3`; el clic derecho resta. Al cambiar de medida, la nueva caja empieza en una unidad. No existe un segundo control de cantidad separado. La tarjeta y el resumen reservan desde el inicio el espacio del contador y del total para que el modal no cambie de tamaño al agregar unidades.
