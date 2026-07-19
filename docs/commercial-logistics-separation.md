# Logística de agencias y configuración comercial

## Resultado observable

- `/agencia` registra únicamente solicitudes físicas para oficina o cliente final.
- `/logistica` revisa y asigna esas solicitudes a rutas existentes.
- `/conductor/tareas` confirma cantidades reales, evidencia y motivos de diferencia, sin mostrar cobros.
- `/agencias` y `/vendedores` forman el panel **Vendedores y Agencias** para perfiles, rutas, servicios y reglas comerciales.
- `/configuracion?view=prices` sigue siendo la fuente base de país para catálogo, precio público, tarifa interna y servicios adicionales.

Ventas, facturas, abonos, pagos, saldos, caja, conciliaciones y cierres continúan en los módulos financieros existentes.

## Arquitectura encontrada y reutilizada

La aplicación es Next.js App Router con acciones de servidor en `src/app/actions`, componentes operativos en `src/components`, autorización por permisos de sesión y PostgreSQL/Supabase como frontera transaccional.

La actualización reutiliza:

- `agency_service_requests`, `agency_service_request_lines`, `agency_visits` y `agency_visit_lines` para solicitud, asignación y confirmación.
- `logistics_routes`, `logistics_route_templates` y `agency_default_route_assignments` para rutas e historial.
- `agency_box_inventory`, `inventory_stock` y las confirmaciones de visita para inventario físico.
- `pricing_countries` y `pricing_country_boxes` como base pública e interna por país.
- `agency_sales`, `sale_lines`, `agency_charges`, facturas y pagos existentes para conservar la separación financiera.
- `immutable_audit_events` para actor, fecha, nivel y valores anterior/nuevo.
- Los permisos, el `AppShell`, `AppTabs`, `Panel` y los controles visuales existentes.

No se creó un segundo módulo de rutas, ventas, facturas, inventario ni agencias.

## Resolución central de valores

`public.resolve_commercial_price(...)` es la fuente del backend. La prioridad es:

1. Excepción individual de agencia o vendedor.
2. Excepción general del grupo de agencias o vendedores.
3. Base del país.

Las filas de `commercial_pricing_overrides` son excepciones temporales, no copias del catálogo del país. La vigencia usa el intervalo semiabierto `[valid_from, valid_until)`. Restaurar un valor cierra la excepción activa y vuelve a resolver el nivel heredado.

El mismo contrato resuelve:

- `public` + `international_shipping`: precio sugerido o público.
- `internal` + `international_shipping`: tarifa que la agencia debe a la matriz.
- `additional_service` + `home_delivery`: entrega o domicilio en cliente de agencia.
- `additional_service` + `home_pickup`: recogida en cliente de agencia.

`calculation_rule` queda como punto de extensión para reglas futuras por zona, ruta, distancia o rango geográfico. La implementación inicial usa `{ "type": "fixed" }`.

## Fotografías históricas de precio

El frontend nunca decide la tarifa interna ni el cargo de domicilio. El backend vuelve a resolver el valor efectivo y guarda:

- `agency_service_request_lines.commercial_price_snapshot` y `unit_charge_amount_cents` al crear una solicitud a domicilio.
- `sale_lines.rate_snapshot`, con precio público y tarifa interna, al crear una venta de agencia.
- El cargo a la matriz solamente con la tarifa interna. El total cobrado al cliente queda en la factura de la agencia.

Cambiar una plantilla después no modifica solicitudes, líneas de venta, facturas ni cargos anteriores.

## Servicios físicos y custodia

Los códigos admitidos son:

- `agency_office_empty_box_delivery`
- `agency_office_full_box_pickup`
- `customer_home_delivery`
- `customer_empty_box_delivery`
- `customer_full_box_pickup`

Una solicitud pertenece a una oficina o a un cliente de agencia, nunca a ambos. El frontend lo guía y el trigger `assert_agency_request_line_scope` lo impide aunque otro cliente escriba directamente.

La confirmación existente exige un motivo cuando la cantidad real difiere. El inventario usa la cantidad confirmada. `agency_box_custody_events` registra titular, movimiento, cantidad, evidencia, visita y hora para entregas vacías y recogidas llenas.

Los clientes de agencia conservan `organization_id` de la agencia. Las paradas de matriz y las visitas de agencia continúan como tipos distintos dentro de la ruta del conductor.

## Perfiles y permisos

`commercial_entity_profiles` guarda país, sede, zona, territorio, frecuencia, estado operativo, servicios habilitados, permiso de modificar precio, descuento máximo, contacto, dirección y opciones logísticas.

- `commercial.settings.view`: lectura del panel.
- `commercial.settings.manage`: cambios de perfil, precios, tarifas y restauración.
- `agency.edit`: también permite cambiar la ruta predeterminada de la agencia.
- La ruta se cambia cerrando la asignación anterior con `ended_at` y creando otra. No se borra historial.

Los roles y usuarios continúan administrándose en el módulo de equipo. El panel comercial solo muestra su contexto y no duplica esa administración.

## Migraciones

- `094_commercial_configuration_inheritance.sql`: permisos, perfiles, bases de servicios adicionales, excepciones por grupo/entidad, resolver central, snapshots, custodia y comandos de solicitudes/ventas/rutas.
- `095_commercial_profile_commands.sql`: guardado autorizado y auditado de perfiles comerciales.
- `096_commercial_override_half_open_intervals.sql`: vigencia semiabierta segura para reemplazar o restaurar dentro de una transacción.
- `097_agency_request_scope_guard.sql`: protección de backend contra solicitudes que mezclen oficina y cliente.
- `098_commercial_price_resolver_authorization.sql`: limita el resolver a la propia entidad o gestores comerciales autorizados.

La migración es conservadora: agrega tablas/columnas, inicializa los dos servicios adicionales desde los valores logísticos actuales y no elimina ni reescribe hechos financieros históricos.

## Verificación

- `npm run test:gate`
- `npm run test:eval`
- `npm run test:commercial-db`
- `npm run test:business-db`
- `npm run db:check`
- `npm run check:code`
- `npm run build`

`scripts/test-commercial-config.mjs` crea fixtures dentro de una transacción y siempre ejecuta `rollback`. Valida país, grupo, entidad, restauración, vendedores, diferencia por agencia, historial de ruta y autorización sin dejar datos de prueba.
