# Auditoría integral de seguridad de Boxario / Paquetería X

**Fecha del análisis:** 2026-07-22
**Checkout:** `C:\Users\pablo\OneDrive\Documentos\scratch\Proyectos propios\paqueteria-x`
**Commit analizado:** `060b41161c914c715e90ce6d69a4d38f0cca5a50` (`main`)
**Modalidad:** revisión estática completa y consultas de catálogo de PostgreSQL local, sin cambios funcionales, sin aplicar migraciones y sin pruebas destructivas.

La auditoría cubrió el árbol completo de aplicación, las 127 migraciones, políticas RLS y ACL efectivas de la base local, funciones `SECURITY DEFINER`, Storage, rutas API, Server Actions, configuración de Next/Supabase, historial Git disponible y dependencias. No debe interpretarse como una certificación de producción: las limitaciones concretas están al final del documento.

# 1. Resumen de la arquitectura

- **Stack:** Next.js 16.2.10 App Router, React 19.2.4, TypeScript, Supabase JS/SSR, PostgreSQL y Supabase Storage. `src/proxy.ts` actúa como frontera web de autenticación.
- **Autenticación:** Supabase Auth por correo/contraseña. Las rutas principales son `src/app/api/auth/sign-in/route.ts`, `src/app/actions/auth.ts`, `src/lib/auth/session.ts`, `src/lib/auth/require.ts` y `src/proxy.ts`.
- **Sesión:** cookies SSR de Supabase; se valida el usuario con `auth.getUser()`. El reloj usa además una cookie propia con token aleatorio cuyo hash se conserva en `time_clock_sessions`; es `HttpOnly`, `SameSite=Lax` y `Secure` en producción.
- **Usuarios:** `auth.users` enlaza con `public.profiles`. El perfil contiene organización y rol; `roles` y `role_permissions` definen capacidades. El modelo nuevo añade `organization_memberships` para los ámbitos de negocio.
- **Multiempresa:** Boxario administra organizaciones. El modelo nuevo usa `business_tenants`, una organización matriz y organizaciones agencia, con `tenant_id`, `organization_id` y `matrix_organization_id`.
- **Autorización:** combinación de `requirePathAccess`, permisos en Server Actions, funciones `user_has_permission`/`current_membership_has_permission`, RLS y RPC. Varias acciones usan `createSupabaseAdminClient()` y por tanto eluden RLS, haciendo indispensable su validación manual.
- **Base de datos:** 127 migraciones en `supabase/migrations`. La base local contiene 120 tablas públicas, vistas `security_invoker`, 133 funciones `SECURITY DEFINER` y ACL por defecto que conceden privilegios amplios a `anon` y `authenticated`.
- **Storage:** buckets privados para evidencias logísticas, vehículos, logos, avatares e ingreso de bodega. `inventory-item-photos` es público.
- **APIs:** `/api/auth/sign-in`, `/api/auth/session`, `/api/conductor/task-results`, `/api/public/tracking` y `/api/validate-address`.
- **Server Actions:** dominios en `src/app/actions/*`: usuarios, roles, ventas/envíos, agencias, finanzas, logística, conductor, bodega, inventario, reloj, plataforma, precios y auditoría.
- **Finanzas:** ventas antiguas en `shipments`/`shipment_payments`; contabilidad multiempresa nueva en `sales`, facturas, cargos, pagos, aplicaciones, asientos y retenciones. Los RPC principales están en las migraciones `071`, `074`, `083`, `094` y posteriores.
- **Custodia e inventario:** `shipment_packages`, tareas, eventos de camión, ingreso de bodega, `package_custody_*`, excepciones, stock y movimientos. Hay idempotencia en varios RPC, pero subsisten caminos directos que evitan los eventos.

Archivos principales: `src/proxy.ts`, `src/lib/auth/*`, `src/lib/supabase/*`, `src/app/actions/*`, `src/app/api/*`, `src/lib/security/*`, `next.config.ts`, `supabase/config.toml` y `supabase/migrations/*.sql`.

# 2. Fronteras de confianza

1. **Navegador → Next:** todo `FormData`, JSON, IDs, precios, estados, fechas, nombres de archivo, `Host`, `X-Forwarded-*` y cookies son entrada no confiable. React evita HTML directo y no se encontró `dangerouslySetInnerHTML`, pero eso no valida la lógica de negocio.
2. **Next → Supabase con JWT:** las consultas normales dependen de RLS. La seguridad real requiere que cada tabla tenga políticas correctas y que las funciones llamadas no eleven privilegios indebidamente.
3. **Next → Supabase con service role:** numerosas acciones administrativas eluden RLS. Deben derivar tenant/organización/usuario de la sesión antes de consultar o mutar. Se encontraron omisiones concretas.
4. **RPC `SECURITY DEFINER`:** ejecutan como propietario y pueden saltar RLS. Deben validar `auth.uid()`, membresía, permiso, tenant, organización, estado e idempotencia dentro de SQL, además de tener ACL mínimas.
5. **Storage:** las rutas de objetos contienen organización y UUID, pero la confidencialidad depende de bucket privado, políticas y URLs firmadas. Un bucket público elimina esa frontera.
6. **Seguimiento público:** usa service role y expone información a quien conozca código de rastreo y cuatro dígitos de teléfono; es una frontera pública de alto valor.
7. **Cliente offline del conductor:** IndexedDB conserva payload y evidencia hasta sincronizar; el servidor debe tratar toda repetición como hostil y no confiar en hora, actor, importe o estado provenientes del dispositivo.
8. **Plataforma/matriz:** consola de plataforma, inicialización de tenants y métricas globales son componentes legítimamente multitenant. Deben quedar aislados a platform admin/service role; actualmente algunas funciones son ejecutables por `anon`.
9. **Validación manual frente a RLS:** los módulos antiguos usan `organization_id`; los nuevos usan tenant+membresía. La coexistencia crea caminos donde una política o acción antigua puede modificar datos que la contabilidad nueva considera autoritativos.

# 3. Hallazgos P0 críticos

## P0-01 — Funciones administrativas y de bootstrap ejecutables por `anon`

- **ID:** P0-01
- **Título:** escalada a administrador de plataforma y creación/inicialización arbitraria de organizaciones mediante ACL efectivas.
- **Estado:** confirmado en la base local.
- **Impacto real:** control administrativo, creación de tenants/perfiles y posible toma de control transversal.
- **Escenario de ataque:** un atacante obtiene/crea un UUID de `auth.users` y llama directamente por PostgREST a `grant_platform_admin(uuid)` o a uno de los overloads de `bootstrap_organization`; las funciones elevan privilegios sin comprobar `auth.uid()` ni rol. Las inicializadoras de matriz/agencia presentan el mismo patrón.
- **Roles afectados:** `anon`, cualquier usuario autenticado y platform admins.
- **Tenants u organizaciones afectados:** todos.
- **Archivo y líneas aproximadas:** `supabase/migrations/003_platform_admin.sql:137-147`; `009_bootstrap_phone_overload.sql`; `067_distribution_acquisition_owners.sql:126`; `076_initialize_new_business_matrix.sql`; `077_agency_demo_team_limits.sql`; `078_fix_matrix_initialization_role_alias.sql`; `124_base_roles_and_suggested_catalog.sql`.
- **Código o lógica responsable:** funciones `SECURITY DEFINER` sin guardas internas; ACL por defecto concede `EXECUTE` a `anon/authenticated`. `GRANT ... TO service_role` no revoca el privilegio ya otorgado.
- **Por qué las protecciones actuales no son suficientes:** ocultar estas llamadas en la UI y comentar “service role only” no cambia las ACL efectivas. `REVOKE FROM PUBLIC` tampoco elimina una concesión explícita a `anon`.
- **Solución recomendada:** migración que revoque de `PUBLIC`, `anon` y `authenticated` todas las funciones internas; conceder solo firmas exactas a `service_role`; añadir guardas internas para defensa en profundidad; eliminar o bloquear overloads históricos; fijar `search_path`.
- **Riesgo de romper funcionalidad:** alto si se omite alguna firma usada por onboarding. Inventariar llamadas de servidor antes de revocar.
- **Pruebas necesarias:** `anon` y usuario común reciben `42501/FORBIDDEN`; service role conserva onboarding; no queda overload expuesto; prueba de catálogo sobre `has_function_privilege`.
- **Dependencias con otros hallazgos:** P0-02, P0-03, P0-05 y P1-09.

## P0-02 — Helpers financieros internos ejecutables sin autenticación

- **ID:** P0-02
- **Título:** alteración o falsificación del libro financiero y de auditoría desde `anon`.
- **Estado:** confirmado.
- **Impacto real:** asientos falsos, operaciones completadas/revertidas y auditorías fabricadas; pérdida de integridad monetaria.
- **Escenario de ataque:** llamada directa a `finance_audit`, `finance_complete_operation`, `finance_post_two_line_entry` o `finance_reverse_journal` con IDs conocidos. Estas funciones no autentican al llamador porque fueron diseñadas como helpers internos.
- **Roles afectados:** `anon` y usuarios autenticados sin permiso financiero.
- **Tenants u organizaciones afectados:** cualquier entidad cuyos UUID se conozcan.
- **Archivo y líneas aproximadas:** `supabase/migrations/071_agency_finance_accounting.sql:700-820, 1030-1160, 2418-2438`.
- **Código o lógica responsable:** ACL por defecto explícita para `anon/authenticated`; el `REVOKE ... FROM public` de la migración 071 no revoca esos roles.
- **Por qué las protecciones actuales no son suficientes:** RLS es eludido por `SECURITY DEFINER`; las tablas inmutables no protegen frente a una función propietaria que inserta o revierte.
- **Solución recomendada:** revocar todas las funciones auxiliares de `anon/authenticated/PUBLIC`, concederlas exclusivamente a service role o hacerlas privadas en otro esquema no expuesto; exponer únicamente RPC de negocio con permiso, ámbito e idempotencia.
- **Riesgo de romper funcionalidad:** alto; los RPC públicos llaman a estos helpers.
- **Pruebas necesarias:** pruebas ACL por firma, creación/reverso autorizado, rechazo de actor sin permiso, balance contable e inmutabilidad.
- **Dependencias con otros hallazgos:** P0-01, P0-07 y P2-08.

## P0-03 — Cualquiera puede cambiar el ciclo de factura/estado de una caja

- **ID:** P0-03
- **Título:** RPC de ciclo de factura de paquetes ejecutables por `anon` y sin ámbito.
- **Estado:** confirmado.
- **Impacto real:** marcar cajas pagadas, en bodega, en tránsito o entregadas; suplantar actor; liberar operaciones indebidamente.
- **Escenario de ataque:** con un UUID de `shipment_packages`, invocar `record_shipment_package_invoice_event/state` indicando estado, hora, actor y fuente elegidos.
- **Roles afectados:** `anon`, clientes y cualquier usuario autenticado.
- **Tenants u organizaciones afectados:** todas.
- **Archivo y líneas aproximadas:** `supabase/migrations/082_package_invoice_lifecycle.sql:50-147, 293-294`.
- **Código o lógica responsable:** las funciones buscan por UUID global, aceptan estado/actor/fuente del llamador y actualizan paquete; no validan sesión, permiso ni organización.
- **Por qué las protecciones actuales no son suficientes:** son `SECURITY DEFINER`; RLS y controles de UI quedan anulados.
- **Solución recomendada:** hacer helpers internos no expuestos; derivar actor de `auth.uid()`; validar organización, transición y operación originadora; separar eventos de sistema de comandos públicos.
- **Riesgo de romper funcionalidad:** alto por triggers y acciones de conductor/bodega que registran esos estados.
- **Pruebas necesarias:** tabla completa de transiciones permitidas, rechazo cross-tenant/anon, actor no falsificable e idempotencia.
- **Dependencias con otros hallazgos:** P0-07, P1-03, P1-04.

## P0-04 — Tablas multitenant sin RLS y con CRUD para `anon`

- **ID:** P0-04
- **Título:** exposición y modificación directa de propuestas de ruta, reversos de liquidación y contadores de bodega.
- **Estado:** confirmado en catálogo.
- **Impacto real:** lectura/escritura/eliminación entre tenants; fraude de reversos; colisiones o denegación de servicio en ingreso.
- **Escenario de ataque:** usar PostgREST directamente sobre `agency_route_proposals`, `driver_settlement_reversals` o `warehouse_intake_counters`; las tres tienen RLS desactivado y privilegios completos para `anon/authenticated`.
- **Roles afectados:** `anon` y todos los usuarios.
- **Tenants u organizaciones afectados:** todos.
- **Archivo y líneas aproximadas:** `supabase/migrations/083_agency_route_operations.sql:21-37`; `071_agency_finance_accounting.sql:484-493`; `117_warehouse_intake_sessions.sql:21-24`.
- **Código o lógica responsable:** creación sin `ENABLE ROW LEVEL SECURITY`; ACL por defecto de tablas concede CRUD.
- **Por qué las protecciones actuales no son suficientes:** filtros de Server Actions no se aplican a PostgREST directo.
- **Solución recomendada:** habilitar RLS; revocar CRUD a `anon/authenticated`; para reversos/contadores, negar escritura directa y usar RPC; políticas tenant+organización para lectura estrictamente necesaria.
- **Riesgo de romper funcionalidad:** medio/alto en contadores y revisión de propuestas.
- **Pruebas necesarias:** catálogo RLS, CRUD anónimo denegado, aislamiento entre dos tenants y concurrencia de contador.
- **Dependencias con otros hallazgos:** P0-01, P1-06.

## P0-05 — Autoescalada de rol mediante actualización del propio perfil

- **ID:** P0-05
- **Título:** un usuario puede sustituir su `role_id` por un rol administrador de su organización.
- **Estado:** confirmado por política efectiva.
- **Impacto real:** escalada vertical y acceso a ventas, configuración, inventario, usuarios y logística.
- **Escenario de ataque:** consultar `roles` visibles de la organización y actualizar directamente `profiles.role_id` del propio usuario por PostgREST.
- **Roles afectados:** cualquier usuario autenticado.
- **Tenants u organizaciones afectados:** su organización; desde allí puede encadenar otros hallazgos.
- **Archivo y líneas aproximadas:** `supabase/migrations/001_roles_permissions_warehouses.sql:348-362`.
- **Código o lógica responsable:** `profiles_update` permite actualizar la fila propia completa y no restringe columnas ni agrega un trigger de campos protegidos.
- **Por qué las protecciones actuales no son suficientes:** la UI de perfil no muestra `role_id`, pero PostgREST admite mass assignment a columnas con privilegio `UPDATE`.
- **Solución recomendada:** separar política de autoedición y administración; revocar UPDATE de columnas sensibles o añadir trigger que prohíba cambiar `role_id`, `organization_id`, `tenant` y campos administrativos salvo comando autorizado; usar RPC para perfil personal.
- **Riesgo de romper funcionalidad:** medio; conservar edición de nombre/avatar/teléfonos.
- **Pruebas necesarias:** usuario edita datos personales, pero no rol/organización; administrador autorizado sí gestiona roles; pruebas cross-org.
- **Dependencias con otros hallazgos:** P0-01, P0-07.

## P0-06 — Precio, pago y estados de envíos confiados al navegador

- **ID:** P0-06
- **Título:** mass assignment financiero en el flujo antiguo de venta/envío.
- **Estado:** confirmado.
- **Impacto real:** ventas a precio arbitrario, utilidad/costo manipulados y factura marcada pagada sin pago válido.
- **Escenario de ataque:** invocar `createShipmentAction` con `cost`, `paid`, `invoiceStatus`, `accountingStatus`, `invoiceNumber` y `logisticsPlan` adulterados; luego `finalizeShipmentInvoiceAction` usa un total previamente suministrado.
- **Roles afectados:** usuario con `sales.manage`; si se encadena P0-05, cualquier usuario.
- **Tenants u organizaciones afectados:** organización del actor y contabilidad relacionada.
- **Archivo y líneas aproximadas:** `src/app/actions/shipments.ts:1205-1493, 1595-1735`.
- **Código o lógica responsable:** parseo de valores del cliente sin recalcular catálogo/precio/total/estado en servidor.
- **Por qué las protecciones actuales no son suficientes:** comprobar que el actor puede vender no autoriza al actor a decidir hechos contables; RLS solo controla fila, no coherencia monetaria.
- **Solución recomendada:** comando transaccional de venta que reciba productos/cantidades y derive precios, totales, estado y número; pagos en comando separado idempotente; rechazar campos de estado.
- **Riesgo de romper funcionalidad:** alto; conviven ventas matriz, rápidas y agencia.
- **Pruebas necesarias:** manipulación de payload, total de servidor, pago parcial/pendiente, duplicados, rollback y paridad de UI.
- **Dependencias con otros hallazgos:** P0-07, P1-01, P1-05.

## P0-07 — Escritura directa permite saltarse auditoría e integridad

- **ID:** P0-07
- **Título:** políticas amplias sobre envíos, pagos y stock permiten mutar hechos autoritativos.
- **Estado:** confirmado.
- **Impacto real:** borrar/cambiar pagos, cambiar estados financieros y alterar stock sin movimiento auditado.
- **Escenario de ataque:** un vendedor autorizado actualiza `shipments.paid/invoice_status/accounting_status/logistics_plan`; modifica/elimina `shipment_payments`; un usuario de inventario actualiza o elimina `inventory_stock` sin insertar `inventory_movements`.
- **Roles afectados:** ventas e inventario con permisos parciales.
- **Tenants u organizaciones afectados:** organización del actor.
- **Archivo y líneas aproximadas:** `supabase/migrations/002_shipments.sql`; `035_shipment_payments.sql:3-58`; `001_roles_permissions_warehouses.sql` políticas `shipments_update`/`inv_stock_write`; `106_inventory_movement_audit.sql`.
- **Código o lógica responsable:** políticas `UPDATE/ALL` por capacidad general, sin restricciones de columnas; falta de inmutabilidad o vínculo obligatorio con un comando/evento.
- **Por qué las protecciones actuales no son suficientes:** los triggers protegen algunos eventos, no las tablas derivadas; PostgREST directo evita Server Actions.
- **Solución recomendada:** revocar mutación directa de hechos financieros/stock; comandos SQL atómicos, columna por columna o triggers; pagos append-only con reversos; stock derivado/mutado solo junto a movimiento.
- **Riesgo de romper funcionalidad:** alto; requiere migrar todos los escritores.
- **Pruebas necesarias:** mutación directa denegada, reverso autorizado, no stock negativo, movimiento obligatorio y consistencia bajo concurrencia.
- **Dependencias con otros hallazgos:** P0-02, P0-03, P0-06.

## P0-08 — Next.js vulnerable en la frontera central de autenticación

- **ID:** P0-08
- **Título:** versión afectada por bypass de Proxy/Middleware y múltiples fallas de Server Actions.
- **Estado:** probable para explotación; versión vulnerable confirmada.
- **Impacto real:** bypass de la protección de páginas, divulgación de endpoints internos, SSRF o denegación de servicio según despliegue.
- **Escenario de ataque:** explotar los advisories aplicables a Next 16.2.10; Boxario depende de `src/proxy.ts` como control central y usa ampliamente Server Actions.
- **Roles afectados:** no autenticados y todos los usuarios.
- **Tenants u organizaciones afectados:** todos.
- **Archivo y líneas aproximadas:** `package.json`, `package-lock.json`, `src/proxy.ts`.
- **Código o lógica responsable:** `next@16.2.10`; `npm audit` indica corrección en 16.2.11.
- **Por qué las protecciones actuales no son suficientes:** RLS reduce parte del impacto, pero acciones con service role y páginas sin defensa secundaria pueden seguir expuestas.
- **Solución recomendada:** actualizar como mínimo a 16.2.11 y verificar notas/advisories; mantener autorización dentro de cada acción/RPC.
- **Riesgo de romper funcionalidad:** medio; actualización patch con posible cambio de compilación.
- **Pruebas necesarias:** suite completa, pruebas de proxy público/privado, Server Actions, cache, imágenes y SSRF.
- **Dependencias con otros hallazgos:** P1-06, P2-02.

# 4. Hallazgos P1 altos

## P1-01 — Creación de envío no atómica

- **ID:** P1-01
- **Título:** una venta se persiste mediante pasos secuenciales y compensaciones parciales.
- **Estado:** confirmado.
- **Impacto real:** envío sin paquetes/pago/tareas, inventario reservado sin venta o auditoría incompleta ante error o carrera.
- **Escenario de ataque:** provocar error/reintento entre inserciones o dos solicitudes concurrentes.
- **Roles afectados:** ventas.
- **Tenants u organizaciones afectados:** organización activa.
- **Archivo y líneas aproximadas:** `src/app/actions/shipments.ts:1205-1493`.
- **Código o lógica responsable:** múltiples llamadas independientes con borrados compensatorios.
- **Por qué las protecciones actuales no son suficientes:** no existe una transacción única ni clave idempotente autoritativa.
- **Solución recomendada:** RPC transaccional idempotente y bloqueo de filas de stock/contadores.
- **Riesgo de romper funcionalidad:** alto.
- **Pruebas necesarias:** fallos inyectados en cada etapa, doble clic y concurrencia.
- **Dependencias con otros hallazgos:** P0-06, P0-07.

## P1-02 — Seguimiento público expone demasiada PII y el rate limit es evadible

- **ID:** P1-02
- **Título:** código de rastreo + cuatro dígitos revela direcciones, teléfonos, destinatario y pagos.
- **Estado:** confirmado.
- **Impacto real:** exposición de PII y datos financieros, enumeración y riesgo físico.
- **Escenario de ataque:** probar códigos/teléfonos; cambiar `X-Forwarded-For` si el proxy no lo normaliza o variar el código para obtener otro bucket.
- **Roles afectados:** público.
- **Tenants u organizaciones afectados:** clientes de todas las organizaciones.
- **Archivo y líneas aproximadas:** `src/app/api/public/tracking/route.ts:14-83`; `src/lib/public-tracking.ts:139-169`; `src/lib/security/request-ip.ts`; `src/lib/security/api-guards.ts:17-48`.
- **Código o lógica responsable:** service role devuelve dirección/teléfono completos e historial monetario; clave de límite `ip|code`.
- **Por qué las protecciones actuales no son suficientes:** cuatro dígitos tienen baja entropía y el límite no agrega presupuesto global por IP/código.
- **Solución recomendada:** minimizar respuesta, enmascarar PII, token público aleatorio de alta entropía/expirable, límites por IP y código independientes, proxy confiable y telemetría.
- **Riesgo de romper funcionalidad:** medio por experiencia de rastreo.
- **Pruebas necesarias:** contrato de datos, fuzz/enumeración, spoof de headers y límites distribuidos.
- **Dependencias con otros hallazgos:** P2-04, P2-08.

## P1-03 — Recepción de custodia no exige al destinatario designado

- **ID:** P1-03
- **Título:** cualquier usuario distinto del iniciador con permiso puede aceptar un traspaso.
- **Estado:** confirmado.
- **Impacto real:** cadena de custodia falsa y liberación por receptor incorrecto.
- **Escenario de ataque:** un operador de la misma organización acepta un handoff dirigido a otra persona/entidad.
- **Roles afectados:** personal con `package.custody.receive`.
- **Tenants u organizaciones afectados:** organización del paquete.
- **Archivo y líneas aproximadas:** `supabase/migrations/092_package_custody_timeline.sql:223-252`; `src/app/actions/controlled-operations.ts:192-201`.
- **Código o lógica responsable:** solo se verifica `initiated_by <> auth.uid()`; no se compara `to_holder_id/type` con el receptor.
- **Por qué las protecciones actuales no son suficientes:** segunda persona no equivale a destinatario autorizado.
- **Solución recomendada:** validar receptor designado o una delegación explícita y auditable; mantener separación de funciones.
- **Riesgo de romper funcionalidad:** medio en handoffs a almacén/roles colectivos.
- **Pruebas necesarias:** receptor correcto, tercero, delegación, cross-org y replay.
- **Dependencias con otros hallazgos:** P0-03.

## P1-04 — Cierre diario permite excepciones bloqueantes abiertas

- **ID:** P1-04
- **Título:** el resumen cuenta excepciones, pero finalizar no las bloquea.
- **Estado:** confirmado.
- **Impacto real:** congelar caja con incidencias sin resolver y debilitar conciliación.
- **Escenario de ataque:** preparar y finalizar el día con `open/pending_approval` o `blocks_release=true`.
- **Roles afectados:** preparador/finalizador de agencia.
- **Tenants u organizaciones afectados:** agencia.
- **Archivo y líneas aproximadas:** `supabase/migrations/087_controlled_operations.sql:390-430`.
- **Código o lógica responsable:** `finalize_agency_daily_close` solo exige estado `prepared` y segundo usuario.
- **Por qué las protecciones actuales no son suficientes:** mostrar el contador en snapshot no impone invariantes.
- **Solución recomendada:** bloquear finalización ante excepciones relevantes o exigir override de doble aprobación con motivo/evidencia; recalcular resumen bajo lock.
- **Riesgo de romper funcionalidad:** medio/alto para cierres con incidencias legítimas.
- **Pruebas necesarias:** excepción bloqueante/no bloqueante, aprobación dual y carreras.
- **Dependencias con otros hallazgos:** P2-08.

## P1-05 — Precio público de agencia puede quedar por debajo del mínimo

- **ID:** P1-05
- **Título:** `create_agency_sale` acepta `publicAmountCents` arbitrario no negativo.
- **Estado:** confirmado.
- **Impacto real:** venta a cero o por debajo de política, pérdida de margen y discrepancia comercial.
- **Escenario de ataque:** vendedor modifica el payload de línea y establece precio público `0`; el cargo interno a matriz permanece.
- **Roles afectados:** vendedor/administrador de agencia.
- **Tenants u organizaciones afectados:** agencia y matriz.
- **Archivo y líneas aproximadas:** `supabase/migrations/094_commercial_configuration_inheritance.sql:596-683`, especialmente 630-634 y 658-660; `099_commercial_minimum_price_guard.sql`.
- **Código o lógica responsable:** solo se rechaza valor negativo; el mínimo configurado no se aplica a la venta.
- **Por qué las protecciones actuales no son suficientes:** el resolver devuelve precio/mínimo, pero el comando deja reemplazarlo.
- **Solución recomendada:** validar contra `minimumAmountCents`/política de descuento; override con permiso específico, motivo y auditoría.
- **Riesgo de romper funcionalidad:** medio por descuentos manuales existentes.
- **Pruebas necesarias:** precio sugerido, mínimo, descuento autorizado/no autorizado y redondeo en centavos.
- **Dependencias con otros hallazgos:** P0-06.

## P1-06 — Lectura de visitas de cualquier conductor sin permiso suficiente

- **ID:** P1-06
- **Título:** usuario no conductor puede pedir rutas y direcciones de otro conductor.
- **Estado:** confirmado.
- **Impacto real:** exposición operativa de rutas, agencias y domicilios.
- **Escenario de ataque:** usuario autenticado llama `listConductorAgencyVisitsAction(driverId)` con cualquier conductor de su organización.
- **Roles afectados:** vendedores y otros roles no conductor.
- **Tenants u organizaciones afectados:** organización del actor.
- **Archivo y líneas aproximadas:** `src/app/actions/agency-operations.ts:317-350`.
- **Código o lógica responsable:** solo restringe cuando `roleSlug === "conductor"`; después usa service role.
- **Por qué las protecciones actuales no son suficientes:** la UI no sustituye `routes.view` ni validación del actor seleccionado.
- **Solución recomendada:** exigir conductor propio o permiso `routes.view/agency.visits.view`; validar membresía y asignación.
- **Riesgo de romper funcionalidad:** bajo/medio para preview administrativo.
- **Pruebas necesarias:** conductor propio/ajeno, admin autorizado, vendedor y cross-org.
- **Dependencias con otros hallazgos:** P0-08.

## P1-07 — Política de líneas de solicitud contiene comparaciones tautológicas

- **ID:** P1-07
- **Título:** posible inyección cross-tenant en borradores de solicitudes de agencia.
- **Estado:** confirmado en política; explotación requiere conocer UUID de solicitud.
- **Impacto real:** líneas ajenas dentro de solicitudes de otro tenant y corrupción operativa.
- **Escenario de ataque:** insertar una línea con tenant propio pero `request_id` de un borrador ajeno; la política compara `request.tenant_id = request.tenant_id`.
- **Roles afectados:** usuario con `agency.requests.create`.
- **Tenants u organizaciones afectados:** dos tenants/agencias.
- **Archivo y líneas aproximadas:** política efectiva originada en `supabase/migrations/072_agency_operations.sql`; `097_agency_request_scope_guard.sql` no corrige este vínculo.
- **Código o lógica responsable:** tautologías para tenant/organización del padre; trigger valida catálogo/alcance funcional, no igualdad de ámbito padre-hijo.
- **Por qué las protecciones actuales no son suficientes:** el FK garantiza existencia, no pertenencia.
- **Solución recomendada:** comparar `request.tenant_id/organization_id` con `NEW.tenant_id/organization_id`; FK compuesto o trigger de scope.
- **Riesgo de romper funcionalidad:** bajo.
- **Pruebas necesarias:** insert/update mismo tenant y cross-tenant, UUID conocido y borrador cerrado.
- **Dependencias con otros hallazgos:** P0-04.

## P1-08 — Suplantación de empleado en reloj por ID global

- **ID:** P1-08
- **Título:** inicio de sesión de reloj no exige PIN, organización ni actor autorizado.
- **Estado:** confirmado.
- **Impacto real:** fraude horario y acceso horizontal a identidad laboral.
- **Escenario de ataque:** usuario autenticado conoce/adivina un Employee ID y crea cookie de reloj para empleado de cualquier organización.
- **Roles afectados:** cualquier usuario con acceso a `/reloj`.
- **Tenants u organizaciones afectados:** todas si el ID coincide.
- **Archivo y líneas aproximadas:** `src/app/actions/time-clock.ts:309-365`; `src/lib/auth/access.ts` (sin permiso específico de `/reloj`).
- **Código o lógica responsable:** consulta service role global por `employee_id_key`; no se llama `requireAppSession`, no hay org/PIN/rate limit.
- **Por qué las protecciones actuales no son suficientes:** token posterior robusto no autentica la creación inicial.
- **Solución recomendada:** terminal explícito por organización, PIN/segundo factor, rate limit, IDs no globalmente enumerables y auditoría contextual.
- **Riesgo de romper funcionalidad:** medio para kiosco.
- **Pruebas necesarias:** empleado propio/ajeno, PIN, bloqueo, expiración y revocación.
- **Dependencias con otros hallazgos:** P2-04.

## P1-09 — Credencial débil de desarrollo versionada e histórica

- **ID:** P1-09
- **Título:** la credencial administrativa deliberadamente débil aparece en archivos rastreados e historial Git.
- **Estado:** confirmado; valor censurado.
- **Impacto real:** quien acceda al repositorio conoce la credencial de desarrollo; grave si el entorno/cuenta se expone.
- **Escenario de ataque:** inspeccionar reglas, documentación, seeds o commits históricos.
- **Roles afectados:** administrador de pruebas.
- **Tenants u organizaciones afectados:** entorno de desarrollo.
- **Archivo y líneas aproximadas:** `AGENTS.md`, `.cursor/rules/no-password-reset.mdc`, `DESARROLLO-LOCAL.md`, `scripts/restore-platform-owner.mjs`, `scripts/seed-conductors.mjs`, `scripts/test-platform-auth-flow.mjs` y múltiples commits.
- **Código o lógica responsable:** literal versionado reutilizado por scripts.
- **Por qué las protecciones actuales no son suficientes:** ignorar `.env.local` no elimina secretos de otros archivos ni historia.
- **Solución recomendada:** **no cambiar ni invalidar la credencial durante esta etapa**; aislarla mediante variable/fixture exclusivamente local no versionado, guardas de entorno y secrets de CI; impedir ejecución en producción. Tratar saneamiento histórico como operación separada y coordinada, no automática.
- **Riesgo de romper funcionalidad:** alto si se rota o elimina; está expresamente prohibido hacerlo ahora.
- **Pruebas necesarias:** escaneo de repo/historial/bundle/logs con el valor conocido sin imprimirlo; scripts fallan cerrados fuera de desarrollo.
- **Dependencias con otros hallazgos:** P0-01, P0-08.

## P1-10 — Cuerpo multipart se parsea antes del límite y filtra errores internos

- **ID:** P1-10
- **Título:** endpoint de resultado del conductor admite consumo de memoria y devuelve excepciones crudas.
- **Estado:** confirmado.
- **Impacto real:** denegación de servicio y divulgación de detalles internos.
- **Escenario de ataque:** POST multipart enorme o malformado; `request.formData()` ocurre antes de validar el archivo y el `catch` devuelve `error.message`.
- **Roles afectados:** cualquier sesión alcanzando el endpoint; impacto global al proceso.
- **Tenants u organizaciones afectados:** todos.
- **Archivo y líneas aproximadas:** `src/app/api/conductor/task-results/route.ts:26-55`; `src/app/actions/conductor-tasks.ts:621-655`.
- **Código o lógica responsable:** ausencia de límite previo de request; validación de 8 MB solo después del parseo.
- **Por qué las protecciones actuales no son suficientes:** el límite de Storage no limita memoria del servidor.
- **Solución recomendada:** límite en proxy/hosting y streaming/parser acotado; respuesta genérica con correlation ID.
- **Riesgo de romper funcionalidad:** bajo/medio.
- **Pruebas necesarias:** 8 MB válido, sobrelímite, multipart corrupto y error sin detalles.
- **Dependencias con otros hallazgos:** P2-06.

# 5. Hallazgos P2 medios

## P2-01 — Redirecciones construidas con Host/X-Forwarded-Host no confiable

- **ID:** P2-01
- **Título:** posible open redirect o envenenamiento de origen.
- **Estado:** probable; depende del proxy de despliegue.
- **Impacto real:** phishing y redirección de autenticación a host atacante.
- **Escenario de ataque:** enviar headers de host reenviado manipulados durante login.
- **Roles afectados:** usuarios al autenticarse.
- **Tenants u organizaciones afectados:** todos.
- **Archivo y líneas aproximadas:** `src/lib/http/request-origin.ts:58-72`; `src/app/api/auth/sign-in/route.ts`.
- **Código o lógica responsable:** el primer host reenviado se acepta sin allowlist.
- **Por qué las protecciones actuales no son suficientes:** validar que sea sintácticamente un host no prueba que sea propio.
- **Solución recomendada:** origen canónico configurado y allowlist; confiar headers solo del proxy conocido.
- **Riesgo de romper funcionalidad:** medio en desarrollo LAN.
- **Pruebas necesarias:** host válido, inválido, múltiples headers y local.
- **Dependencias con otros hallazgos:** P1-02.

## P2-02 — Headers web de endurecimiento incompletos

- **ID:** P2-02
- **Título:** faltan CSP, HSTS, anti-framing y políticas globales.
- **Estado:** confirmado.
- **Impacto real:** mayor impacto de XSS futuro, clickjacking y fuga de referrer.
- **Escenario de ataque:** incrustar la app o aprovechar una inyección futura.
- **Roles afectados:** todos.
- **Tenants u organizaciones afectados:** todos.
- **Archivo y líneas aproximadas:** `next.config.ts`.
- **Código o lógica responsable:** solo hay `X-Content-Type-Options` puntual para `sw.js` y no-store de API conductor.
- **Por qué las protecciones actuales no son suficientes:** cabeceras parciales no cubren páginas.
- **Solución recomendada:** CSP con nonce/hash compatible, HSTS solo HTTPS producción, `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy` y nosniff global.
- **Riesgo de romper funcionalidad:** medio por QR, imágenes, Supabase y Google.
- **Pruebas necesarias:** headers por entorno y reporte CSP antes de enforcement.
- **Dependencias con otros hallazgos:** P0-08.

## P2-03 — Dependencias adicionales vulnerables

- **ID:** P2-03
- **Título:** `sharp`, `brace-expansion`, `exceljs/uuid` reportan vulnerabilidades.
- **Estado:** confirmado por `npm audit --omit=dev`.
- **Impacto real:** DoS/procesamiento de imagen y bounds issue en UUID según ruta de uso.
- **Escenario de ataque:** entradas especialmente construidas alcanzan paquete vulnerable.
- **Roles afectados:** público o usuarios que importan/exportan según paquete.
- **Tenants u organizaciones afectados:** todos.
- **Archivo y líneas aproximadas:** `package.json`, `package-lock.json`.
- **Código o lógica responsable:** 3 altas y 2 moderadas totales, incluyendo transitivas.
- **Por qué las protecciones actuales no son suficientes:** los paquetes se cargan en producción.
- **Solución recomendada:** actualizar Next a 16.2.11 para `sharp`; resolver `brace-expansion`; evaluar upgrade/reemplazo de `exceljs` sin aceptar automáticamente el downgrade sugerido por audit.
- **Riesgo de romper funcionalidad:** medio en Excel e imágenes.
- **Pruebas necesarias:** import/export XLSX, imágenes, lockfile y audit limpio/aceptación documentada.
- **Dependencias con otros hallazgos:** P0-08.

## P2-04 — Rate limiting falla abierto y usa claves débiles

- **ID:** P2-04
- **Título:** sin admin client no hay límite; login carece de presupuesto puro por IP/cuenta.
- **Estado:** confirmado.
- **Impacto real:** fuerza bruta y enumeración cuando el servicio de límite falla o se rota la dimensión de clave.
- **Escenario de ataque:** variar email/código/IP o provocar ausencia del cliente admin.
- **Roles afectados:** público.
- **Tenants u organizaciones afectados:** todos.
- **Archivo y líneas aproximadas:** `src/lib/security/api-guards.ts:31-77`; `src/lib/security/request-ip.ts`.
- **Código o lógica responsable:** retorno silencioso si no hay admin y claves compuestas únicas.
- **Por qué las protecciones actuales no son suficientes:** límite por combinación no limita cada dimensión.
- **Solución recomendada:** fail closed o degradación segura; presupuestos por IP, cuenta y recurso; proxy confiable y alertas.
- **Riesgo de romper funcionalidad:** medio ante indisponibilidad.
- **Pruebas necesarias:** fallo de backend, rotación de dimensiones, ventanas y concurrencia.
- **Dependencias con otros hallazgos:** P1-02, P1-08.

## P2-05 — Bucket público de fotos de inventario

- **ID:** P2-05
- **Título:** imágenes de catálogo quedan accesibles mediante URL permanente.
- **Estado:** confirmado en `storage.buckets`.
- **Impacto real:** fuga de imágenes/metadatos si se obtiene la ruta.
- **Escenario de ataque:** compartir, registrar o descubrir URL de objeto de otra organización.
- **Roles afectados:** público.
- **Tenants u organizaciones afectados:** organizaciones con fotos.
- **Archivo y líneas aproximadas:** `supabase/migrations/103_inventory_item_photos.sql`; `src/lib/inventory-photos.ts`.
- **Código o lógica responsable:** bucket `inventory-item-photos` con `public=true`.
- **Por qué las protecciones actuales no son suficientes:** UUID de ruta reduce descubrimiento, no revoca acceso.
- **Solución recomendada:** confirmar si son realmente públicas; si no, bucket privado y URL firmada corta ligada a organización.
- **Riesgo de romper funcionalidad:** medio por renderizado/caché.
- **Pruebas necesarias:** acceso anónimo, cross-org, expiración y caché.
- **Dependencias con otros hallazgos:** P2-06.

## P2-06 — Archivos se validan por MIME declarado, no por contenido

- **ID:** P2-06
- **Título:** archivos polyglot o MIME falsificado pueden almacenarse como evidencia/imagen.
- **Estado:** confirmado como defensa insuficiente.
- **Impacto real:** contenido inesperado, riesgo al descargar/procesar y evidencia inválida.
- **Escenario de ataque:** subir bytes HTML/ejecutable con `file.type=image/jpeg` y extensión permitida.
- **Roles afectados:** usuarios con subida y conductor.
- **Tenants u organizaciones afectados:** propia organización; posible receptor de evidencia.
- **Archivo y líneas aproximadas:** `src/app/actions/conductor-tasks.ts:621-655`; `src/lib/account/profile-validation.ts`; `src/lib/inventory-photos.ts`; `src/lib/logistics-fleet.ts`; `src/app/actions/organization.ts`.
- **Código o lógica responsable:** tamaño y allowlist MIME, sin magic-byte/decode/re-encode.
- **Por qué las protecciones actuales no son suficientes:** MIME y nombre son controlados por cliente.
- **Solución recomendada:** identificar bytes, decodificar/re-encodear imágenes, generar nombre/extensión del tipo real, mantener SVG/HTML excluidos.
- **Riesgo de romper funcionalidad:** medio por HEIC/cámaras.
- **Pruebas necesarias:** JPEG/PNG/WebP reales, MIME falso, polyglot, SVG y corruptos.
- **Dependencias con otros hallazgos:** P1-10, P2-05.

## P2-07 — Datos privados residuales en cache/IndexedDB del conductor

- **ID:** P2-07
- **Título:** páginas y evidencias offline permanecen en dispositivo sin cifrado.
- **Estado:** confirmado; riesgo depende de dispositivo compartido/comprometido.
- **Impacto real:** exposición local de direcciones, tareas y fotos.
- **Escenario de ataque:** otro usuario accede al perfil del navegador antes/después de logout incompleto.
- **Roles afectados:** conductores.
- **Tenants u organizaciones afectados:** organización del conductor.
- **Archivo y líneas aproximadas:** `public/sw.js`; `src/lib/conductor-offline/queue.ts`.
- **Código o lógica responsable:** Cache Storage privado por usuario e IndexedDB con blobs; limpieza depende de mensajes de logout/sincronización.
- **Por qué las protecciones actuales no son suficientes:** aislamiento lógico no cifra ni garantiza borrado ante cierre abrupto.
- **Solución recomendada:** TTL, borrado verificable en logout/cambio de usuario, minimizar PII offline y política de dispositivo.
- **Riesgo de romper funcionalidad:** medio para operación sin conexión.
- **Pruebas necesarias:** logout, cambio de conductor, crash, TTL y scope.
- **Dependencias con otros hallazgos:** ninguno.

## P2-08 — Auditoría incompleta y función capaz de fabricar eventos

- **ID:** P2-08
- **Título:** no todos los cambios capturan antes/después, IP/contexto; helper de auditoría está expuesto.
- **Estado:** confirmado.
- **Impacto real:** atribución débil y posibilidad de crear trazas falsas o evadirlas mediante escritura directa.
- **Escenario de ataque:** usar P0-02 para insertar auditoría falsa o P0-07 para modificar estado sin evento equivalente.
- **Roles afectados:** usuarios financieros/operativos y `anon`.
- **Tenants u organizaciones afectados:** todos.
- **Archivo y líneas aproximadas:** `supabase/migrations/070_business_tenants_agencies.sql`; `071_agency_finance_accounting.sql`; `src/app/actions/history.ts`.
- **Código o lógica responsable:** eventos heterogéneos; metadatos no normalizados; ausencia general de IP y diffs.
- **Por qué las protecciones actuales no son suficientes:** inmutabilidad física de algunas tablas no garantiza completitud/autenticidad de origen.
- **Solución recomendada:** cerrar ACL, esquema uniforme actor/tenant/org/entidad/antes/después/motivo/contexto y comandos únicos; no registrar secretos/PII innecesaria.
- **Riesgo de romper funcionalidad:** medio por volumen y privacidad.
- **Pruebas necesarias:** cobertura por comando, inmutabilidad, actor real y no falsificable.
- **Dependencias con otros hallazgos:** P0-02, P0-07, P1-04.

## P2-09 — Errores de base de datos llegan al cliente

- **ID:** P2-09
- **Título:** numerosas acciones propagan `error.message`.
- **Estado:** confirmado.
- **Impacto real:** divulgación de nombres de tablas, RPC, constraints y lógica interna.
- **Escenario de ataque:** enviar datos inválidos para provocar mensajes distintivos.
- **Roles afectados:** autenticados y algunos endpoints públicos.
- **Tenants u organizaciones afectados:** todos.
- **Archivo y líneas aproximadas:** `src/app/actions/*` mediante `actionErrorMessage`; `src/app/api/conductor/task-results/route.ts`.
- **Código o lógica responsable:** errores crudos usados como mensaje de UX.
- **Por qué las protecciones actuales no son suficientes:** no existe catálogo estable de errores públicos.
- **Solución recomendada:** mapear códigos seguros, correlation ID y logging estructurado redactado.
- **Riesgo de romper funcionalidad:** bajo/medio por mensajes esperados por UI.
- **Pruebas necesarias:** constraint/RPC/fallo red sin detalles internos.
- **Dependencias con otros hallazgos:** P1-10.

## P2-10 — Configuración de sesión y Auth local débil

- **ID:** P2-10
- **Título:** signup habilitado, mínimo de 6 caracteres, sin MFA ni timeout absoluto/inactividad en configuración local.
- **Estado:** configuración insegura solo en desarrollo; producción no verificada.
- **Impacto real:** cuentas débiles y sesiones prolongadas si la configuración se replica.
- **Escenario de ataque:** signup directo a Supabase y password spraying.
- **Roles afectados:** todos.
- **Tenants u organizaciones afectados:** entorno local; producción desconocida.
- **Archivo y líneas aproximadas:** `supabase/config.toml`; lógica `src/lib/auth/public-signup.ts`.
- **Código o lógica responsable:** `enable_signup=true`, `minimum_password_length=6`, sin MFA/timebox/inactivity.
- **Por qué las protecciones actuales no son suficientes:** la UI deshabilita signup en producción, pero el endpoint Auth se configura fuera de la UI.
- **Solución recomendada:** separar config prod/dev, deshabilitar signup público en producción, política robusta y expiración/revocación; preservar la credencial de pruebas solo en dev.
- **Riesgo de romper funcionalidad:** alto si se aplica a desarrollo sin separación.
- **Pruebas necesarias:** config desplegada, signup directo, expiración, refresh rotation y revocación.
- **Dependencias con otros hallazgos:** P0-01, P1-09.

# 6. Mejoras P3

- Añadir validación `Origin/Host` explícita en APIs mutantes como defensa CSRF; `SameSite=Lax` ayuda, pero no cubre subdominios comprometidos.
- Declarar CORS de forma explícita y mínima; hoy no se encontró una política permisiva, pero debe probarse en el hosting real.
- Confirmar `productionBrowserSourceMaps=false` de forma explícita y revisar artefactos del proveedor.
- Aplicar `Cache-Control: private, no-store` uniforme a respuestas con sesión/PII y pruebas de CDN; ya existe en rutas sensibles puntuales.
- Mantener todas las vistas con `security_invoker=true` y agregar un gate de esquema que falle si aparece una vista sin esa opción.
- Establecer `FORCE ROW LEVEL SECURITY` donde propietarios no deban omitirla; actualmente ninguna tabla lo usa.
- Añadir schema validation compartida (por ejemplo Zod) a comandos complejos; hoy predominan parseos manuales heterogéneos.
- Mantener rechazo de SVG/HTML y ausencia de `dangerouslySetInnerHTML`; agregar pruebas para evitar regresiones.
- Revisar retención, expiración y eliminación de URLs firmadas y evidencias.
- Capturar métricas/alertas de fallos de autenticación, rate limits, ACL denegadas y operaciones financieras anómalas sin registrar secretos.

# 7. Matriz de rutas y permisos

“Frontend” indica control de navegación/UI, no una barrera de seguridad. “Servidor” describe el control autoritativo observado.

| Ruta o acción | Tipo | Permiso requerido actualmente | Permiso que debería requerir | Frontend | Servidor | RLS aplicable | Riesgo detectado |
|---|---|---|---|---|---|---|---|
| `/login`, `/api/auth/sign-in` | página/API | pública | pública + rate limit robusto | formulario | Auth Supabase + límite | N/A | claves de rate limit incompletas |
| `signUpAction` | Server Action | flag dev | solo flujo explícito de entorno/onboarding | UI oculta en prod | flag de app | Auth externo | Auth directo puede diferir de UI |
| `/api/auth/session` | API | sesión | sesión | sí | `getUser()` | perfiles | bajo |
| `signOutAction` | Server Action | sesión | sesión | sí | Supabase logout | N/A | correcto; probar limpieza offline |
| `/rastrear`, `/api/public/tracking` | página/API | código + 4 dígitos | token fuerte/expirable + mínimos datos | pública | service role + rate limit | eludida | PII excesiva, enumeración |
| `/api/validate-address` | API | sesión | sesión + límite | sí | sesión, body 8 KB, Google fijo | N/A | aceptable; revisar logs/proxy |
| `/api/conductor/task-results` | API | sesión/conductor dentro de acción | conductor asignado | UI conductor | acción valida tarea | eludida por admin | multipart sin límite previo |
| `/plataforma` + acciones `platform.ts` | página/acciones | platform admin | platform admin | `requirePathAccess` | guardas manuales + service role | eludida | RPC admin expuestos por separado |
| `/venta`, `createShipmentAction` | página/acción | `sales.manage` | `sales.create` + precio server-side | sí | permiso general | shipments | mass assignment, no transacción |
| `finalizeShipmentInvoiceAction` | Server Action | `sales.manage` | `payments.collect` y total derivado | sí | sesión/RPC | parcial | total base no confiable |
| `shipment_payments` vía PostgREST | tabla/API | `sales.manage` | sin escritura directa | no | RLS amplia | sí | update/delete de pago |
| `createAgencySaleAction` / `create_agency_sale` | acción/RPC | `agency.sales.create` | igual + política de mínimo/override | sí | acción y RPC | definer | precio público bajo mínimo |
| `recordAgencyPaymentAction` | acción/RPC | permiso financiero de agencia | igual + idempotencia/estado | sí | RPC con membresía | definer | helpers internos expuestos |
| `reconcileDriverSettlementAction` | acción/RPC | conciliación | igual + actor dual cuando aplique | sí | RPC | definer | tabla de reversos sin RLS |
| `reverseFinancialEventAction` | acción/RPC | reverso financiero | igual + motivo/evidencia | sí | RPC | definer | helper de reverso expuesto |
| `authorizeInternationalReleaseAction` | acción/RPC | liberación financiera | igual + retención/saldo derivados | sí | RPC/trigger | definer | proteger contra helpers directos |
| `/agencias`, acciones de red | página/acciones | capacidades de agencia/captor | capacidades específicas | sí | variable | sí/definer | propuestas sin RLS |
| `listConductorAgencyVisitsAction` | Server Action | solo autocontrol si conductor | conductor propio o `routes.view` | panel | insuficiente + service role | eludida | lectura de otro conductor |
| `createAgencyBoxRequestAction` | Server Action/RPC | `agency.requests.create` | igual, padre-hijo mismo scope | sí | RPC/RLS | sí | política de líneas tautológica |
| `/logistica`, acciones de rutas | página/acciones | `routes.*` | capacidades por operación | sí | guardas manuales | sí | IDs deben permanecer scoped |
| `record_shipment_package_invoice_*` | función SQL | efectivamente `anon` | solo helpers internos | no | sin guardas | elude | cambio arbitrario de estado |
| `/conductor/tareas` | página | conductor o admin preview | conductor propio / admin con `routes.view` | sí | tarea se vuelve a cargar | eludida por admin | entrada de archivo/errores |
| `start/complete conductor route` | Server Action | conductor asignado/admin | igual + estado/custodia | sí | validación de tarea/ruta | eludida | revisar carreras; base razonable |
| `/bodega`, `warehouse-intake` | página/acciones/RPC | permisos de bodega | scan físico y almacén asignado | sí | RPC con operación key | definer | contador sin RLS; helpers expuestos |
| `/operaciones-controladas` | página | capacidad derivada | capacidades por comando | sí | RPC | definer | receptor no designado |
| `approveOperationalExceptionAction` | acción/RPC | aprobar excepción | aprobador distinto + scope | sí | RPC valida segundo actor | definer | conservar; auditoría incompleta |
| `finalizeAgencyDailyCloseAction` | acción/RPC | `agency.daily_close.finalize` | igual + no bloqueos/override dual | sí | segundo actor | definer | no bloquea excepciones |
| `/inventario` y acciones | página/acciones | `inventory.*` | capacidad granular + movimiento atómico | sí | manual/RPC mixto | sí | stock directo elude movimiento |
| uploads inventario/avatar/logo/vehículo | Server Action/Storage | permiso de entidad | igual + verificación de bytes | sí | tamaño/MIME | Storage + admin | MIME controlado por cliente |
| `/reloj`, `startTimeClockSessionAction` | página/acción | cualquier usuario no conductor alcanzable | terminal/org + PIN + límite | ingreso ID | service role global | eludida | suplantación cross-org |
| `recordTimeClockAction` | Server Action | cookie reloj | sesión reloj vigente + reglas | sí | hash token/estado | service role | origen inicial débil |
| `/configuracion`, usuarios/roles | páginas/acciones | `settings/users/permissions.manage` | capacidades granulares | sí | acciones scoped | sí/admin | perfil directo permite autoescalada |
| `profiles_update` | política RLS | propio o `users.manage` | propio solo campos personales | no | RLS | sí | cambio de `role_id` |
| `grant_platform_admin` | función SQL | efectivamente `anon` | service role únicamente | no | ninguna guarda | elude | toma de plataforma |
| `bootstrap_organization`/inicializadores | función SQL | efectivamente `anon` | service role únicamente | no | ninguna guarda | elude | creación arbitraria |
| `finance_*` helpers | función SQL | efectivamente `anon` | internos únicamente | no | sin autorización de actor | elude | alteración contable |
| métricas distribución | Server Action | roles de distribución | scope explícito | sí | service role + filtro memoria | eludida | sobrelectura global |

# 8. Matriz de tablas y RLS

La columna “service role” es **bypass** para todas las tablas: el rol de servicio tiene `BYPASSRLS` y además ACL amplias. Las filas agrupadas comparten el patrón indicado; se enumeran todas las tablas públicas observadas. `ALL` representa políticas que cubren INSERT/UPDATE/DELETE.

| Tabla | Tiene RLS | SELECT | INSERT | UPDATE | DELETE | Tenant | Organización | Service role | Problemas encontrados |
|---|---:|---|---|---|---|---|---|---|---|
| `agency_route_proposals` | **No** | ACL directa | ACL directa | ACL directa | ACL directa | no | no | bypass | **P0 cross-tenant** |
| `driver_settlement_reversals` | **No** | ACL directa | ACL directa | ACL directa | ACL directa | no | no | bypass | **P0 financiero** |
| `warehouse_intake_counters` | **No** | ACL directa | ACL directa | ACL directa | ACL directa | no | no | bypass | **P0/P1 contador** |
| `app_schema_migrations`, `commercial_invoice_counters`, `journal_entry_counters`, `time_clock_sessions` | sí | ninguna para cliente | ninguna | ninguna | ninguna | implícito | implícito | exclusivo práctico | correcto si solo RPC/service role |
| `profiles` | sí | org / plataforma | org / plataforma | propio/org/plataforma | no | no explícito | sí | bypass | autoescalada de `role_id` |
| `roles` | sí | org/plataforma | `permissions.manage` | `permissions.manage` | `permissions.manage` | no explícito | sí | bypass | necesita FK/guardas de columnas |
| `role_permissions` | sí | rol de org | `ALL permissions.manage` | `ALL` | `ALL` | no explícito | sí | bypass | aceptable si P0-05 se corrige |
| `organizations` | sí | propia/plataforma/business scope | plataforma | settings/plataforma | no | sí parcial | sí | bypass | mutación amplia; triggers solo plan/logo |
| `organization_memberships` | sí | propia/permiso/plataforma | deny | deny | deny | sí | sí | bypass | buen patrón |
| `permissions` | sí | catálogo `true` | no | no | no | global | global | bypass | catálogo intencional |
| `platform_admins` | sí | solo propio | no | no | no | global | global | bypass | función grant rompe protección |
| `business_tenants` | sí | tenant actual | no | no | no | sí | N/A | bypass | buen patrón |
| `accounting_periods`, `gl_accounts`, `journal_entries`, `journal_lines` | sí | lectura financiera scoped | no directa | no directa | no directa | sí | sí | bypass | helpers ACL rompen frontera |
| `immutable_audit_events` | sí | permiso auditoría | deny | deny | deny | sí | sí | bypass | `finance_audit` anónimo |
| `idempotency_operations`, `security_rate_limits` | sí | deny | deny | deny | deny | por RPC | por RPC | bypass | patrón correcto; helpers expuestos |
| `sales`, `sale_lines`, `customer_invoices`, `customer_invoice_lines`, `customer_credit_notes` | sí | scoped read | no directa | no directa | no directa | sí | sí | bypass | buen modelo nuevo |
| `agency_charges`, `agency_payments`, `agency_payment_applications`, `agency_payment_application_reversals`, `agency_credits`, `agency_adjustments`, `agency_financial_reversals` | sí | scoped read | no directa | no directa | no directa | sí | sí | bypass | revisar ACL de helpers |
| `customer_payments`, `customer_payment_applications`, `customer_payment_application_reversals`, `customer_payment_reversals` | sí | scoped read | no directa | no directa | no directa | sí | sí | bypass | buen patrón nuevo |
| `driver_cash_custody_events`, `driver_settlements`, `driver_settlement_lines` | sí | scoped read | no directa | no directa | no directa | sí | sí | bypass | reversos quedan fuera en tabla sin RLS |
| `financial_holds`, `financial_hold_events`, `financial_hold_release_requests`, `financial_hold_release_approvals` | sí | scoped read | no directa | no directa | no directa | sí | sí | bypass | buen patrón; probar liberación |
| `financial_hold_policies` | sí | tenant scoped | no directa | no directa | no directa | sí | no explícito | bypass | scope de org debe revisarse por caso |
| `internal_rate_versions`, `internal_rate_lines`, `agency_price_list_versions`, `agency_price_list_lines` | sí | scoped | `ALL` por permiso | `ALL` | `ALL` | sí | sí | bypass | historia debe quedar temporal/inmutable |
| `commercial_entity_profiles`, `commercial_pricing_overrides`, `country_commercial_service_settings` | sí | scoped | por RPC | por RPC | por RPC | sí | sí | bypass | configuración comercial central |
| `agencies`, `agency_status_history`, `agency_captor_assignments`, `captor_supervisor_assignments`, `agency_support_delegations` | sí | scoped | deny directa | deny directa | deny directa | sí | sí | bypass | buen patrón por comandos |
| `agency_service_requests` | sí | scoped | permiso create | permiso create | no | sí | sí | bypass | validar transiciones |
| `agency_service_request_lines` | sí | scoped | permiso create | permiso create | no | sí declarado | sí declarado | bypass | **tautología padre-hijo** |
| `agency_request_status_history`, `agency_visit_status_history`, `agency_visits`, `agency_visit_lines` | sí | scoped | por RPC | por RPC | no | sí | sí | bypass | lectura action P1-06 |
| `agency_default_route_assignments`, `agency_shipment_box_sources`, `agency_box_allocations`, `agency_box_batches`, `agency_box_custody_events`, `agency_box_lots`, `agency_box_movements`, `agency_visit_lines` | sí | scoped read | por RPC/triggers | por RPC/triggers | no | sí | sí | bypass | custodia depende de comandos |
| `agency_daily_closures`, `agency_daily_closure_events` | sí | org | por RPC | por RPC | no/evento inmutable | no explícito | sí | bypass | cierre no bloquea excepciones |
| `operational_exceptions`, `operational_exception_events` | sí | org | por RPC | por RPC | no/evento inmutable | no explícito | sí | bypass | evidencia obligatoria; revisar cierre |
| `package_custody_handoffs`, `package_custody_events` | sí | org | por RPC | por RPC | handoff no delete/evento read-only | no explícito | sí | bypass | receptor no designado; RPC estado expuesto |
| `shipments` | sí | org | `sales.manage` | `sales.manage`/owner | no | no explícito | sí | bypass | columnas financieras mutables |
| `shipment_payments` | sí | org | `ALL sales.manage` | `ALL` | `ALL` | no explícito | sí | bypass | pago no inmutable |
| `shipment_packages` | sí | org | `ALL` por operaciones | `ALL` | `ALL` | no explícito | sí | bypass | transición por helper anónimo |
| `shipment_package_invoice_events` | sí | org | por helper | no directa | no directa | no explícito | sí | bypass | actor/estado falsificable vía RPC |
| `shipment_logistics_tasks`, `shipment_logistics_task_attempts`, `shipment_contact_logs` | sí | org | `ALL` por rutas | `ALL` | `ALL` | no explícito | sí | bypass | políticas amplias; acciones revalidan parcialmente |
| `activity_history` | sí | permisos org | insert org/permisos | no | no | no explícito | sí | bypass | append-only, pero cobertura incompleta |
| `customers`, `customer_recipients` | sí | org | org/permiso | org/permiso | org/permiso | no explícito | sí | bypass | PII; acciones generalmente scoped |
| `customer_route_assignment_requests`, `customer_route_verifications` | sí | org | org | org/`ALL` | `ALL` verificación | no explícito | sí | bypass | revisar revocación al cambiar zona |
| `inventory_categories`, `inventory_items` | sí | org | `ALL` permisos | `ALL` | `ALL` | no explícito | sí | bypass | historial protege borrado parcialmente |
| `inventory_stock` | sí | org+warehouse | `ALL adjust/reserve/assign/return` | `ALL` | `ALL` | no explícito | sí | **salta movimientos** |
| `inventory_bin_stock`, `warehouse_bins`, `warehouse_pallets` | sí | org/warehouse | `ALL` permiso | `ALL` | `ALL` | no explícito | sí | bypass | asegurar operación atómica |
| `inventory_movements` | sí | org+warehouse | permiso de movimiento | no | no | no explícito | sí | bypass | append-only correcto, pero stock directo |
| `inventory_assignments` | sí | org | permiso | permiso | no | no explícito | sí | bypass | validar usuario/almacén |
| `inventory_sale_reservations`, `inventory_warehouse_transfers` | sí | org | por RPC | por RPC | por RPC | no explícito | sí | bypass | probar carreras/replay |
| `warehouses` | sí | org/plataforma | settings | settings | no | no explícito | sí | bypass | scope explícito |
| `warehouse_intake_sessions`, `warehouse_intake_expected_packages`, `warehouse_intake_items`, `warehouse_intake_events` | sí | org | por RPC | por RPC | no | no explícito | sí | bypass | contador hermano sin RLS |
| `logistics_routes`, `logistics_route_stops`, `logistics_route_templates`, `logistics_weekday_defaults`, `organization_route_settings` | sí | org | `ALL routes.*` | `ALL` | `ALL` | no explícito | sí | bypass | políticas por org/capacidad |
| `logistics_route_live_locations`, `logistics_route_location_samples` | sí | org | rutas/conductor | rutas/conductor | `ALL` live | no explícito | sí | bypass | datos sensibles de ubicación |
| `logistics_vehicles`, `logistics_truck_inventory_events` | sí | org | `ALL` rutas | `ALL` | `ALL` | no explícito | sí | bypass | eventos deberían ser append-only |
| `organization_invoice_counters` | sí | org | `ALL` permiso | `ALL` | `ALL` | no explícito | sí | bypass | preferir RPC/lock |
| `pricing_countries`, `pricing_country_boxes`, `pricing_promotions`, `distributors`, `distributor_country_boxes` | sí | org | `ALL` pricing | `ALL` | `ALL` | no explícito | sí | bypass | configuración antigua mutable |
| `distribution_partners`, `distribution_partner_offers`, `distribution_partner_ledger`, `distribution_partner_owner_history` | sí | deny directo | deny | deny | deny | por funciones | por funciones | bypass | buen deny; sobrelectura service role en métricas |
| `profile_phones`, `profile_warehouses` | sí | org | `ALL` personal/admin | `ALL` | `ALL` | no explícito | sí | bypass | validar campos personales |
| `time_clock_settings`, `time_clock_employees`, `time_clock_alerts` | sí | org | `ALL time_clock.manage` | `ALL` | `ALL` | no explícito | sí | bypass | inicio de reloj elude RLS |
| `time_clock_events` | sí | org | por action/service | no | no | no explícito | sí | bypass | evento inmutable razonable |

Observaciones globales de catálogo:

- Ninguna tabla tiene `FORCE ROW LEVEL SECURITY`.
- Las vistas públicas observadas usan `security_invoker=true`.
- Los ACL por defecto del esquema público conceden funciones/tablas/secuencias a `anon`, `authenticated` y `service_role`; debe corregirse la plantilla para que nuevas migraciones no reintroduzcan exposición.
- “Sin política” con RLS activo niega al cliente y es adecuado para contadores/sesiones internas; no debe confundirse con las tres tablas donde RLS está desactivado.

# 9. Flujos críticos

## 9.1 Inicio de sesión

1. El navegador envía email/password a `/api/auth/sign-in`.
2. Se aplica límite por `ip|email`; falla abierto si no existe admin client.
3. Supabase valida credenciales y establece cookies SSR.
4. El destino interno se sanea, pero el origen absoluto puede derivarse de `Host/X-Forwarded-Host`.
5. `src/proxy.ts` usa `getUser()` y permite solo rutas públicas exactas; páginas llaman además `requirePathAccess`.
6. **Autorización:** sesión válida y luego capacidades de perfil.
7. **Tenant/organización:** se derivan del perfil/membresía al construir `AppSession`.
8. **Estado/idempotencia:** no aplica.
9. **Huecos:** Next vulnerable, rate limit, config Auth externa no verificada y origen no allowlisted.

## 9.2 Creación de usuario

1. En producción, la UI de signup se deshabilita; en desarrollo depende de flag.
2. Platform/org admin invita o crea usuario mediante acciones con service role.
3. Se crea `auth.users`, perfil, rol, teléfono, almacenes y/o membresía.
4. **Autorización:** acciones de `platform.ts`/`users.ts` comprueban platform admin o `users.manage`.
5. **Tenant/organización:** acciones filtran el objetivo; SQL bootstrap no lo hace internamente.
6. **Estado/idempotencia:** compensaciones variables, no comando uniforme.
7. **Huecos:** funciones bootstrap/initializers anónimas y autoactualización de rol.

## 9.3 Creación de venta de matriz

1. `/venta` obtiene cliente, destinatario, cajas, catálogo, pago y plan logístico.
2. El cliente calcula/envía costo, pago, estados, número y plan.
3. `createShipmentAction` valida sesión/`sales.manage` y organización.
4. Inserta shipment, paquetes, pago, tareas, reservas/movimientos y auditoría en llamadas separadas.
5. **Montos:** no se recalculan completamente en servidor.
6. **Estado:** varios estados vienen del payload.
7. **Idempotencia:** no hay clave autoritativa para toda la venta.
8. **Huecos:** P0-06/P1-01; es necesario un único comando transaccional.

## 9.4 Creación de venta de agencia

1. UI llama `createAgencySaleAction` con comando y key.
2. La acción exige `agency.sales.create`.
3. RPC deriva tenant, organización agencia, membresía, agencia activa y tarifa interna.
4. Crea `sales`, factura/lineas y cargo de agencia a matriz; completa operación idempotente.
5. **Tenant/organización:** derivados en SQL y validados.
6. **Montos:** tarifa interna server-side; precio público puede venir del cliente.
7. **Estado/idempotencia:** key gestionada en `idempotency_operations`.
8. **Huecos:** no aplica mínimo/permiso de descuento al precio público.

## 9.5 Creación de envío

1. En el flujo antiguo coincide con venta matriz y crea `shipments`/`shipment_packages`.
2. Planifica entrega/recolección y puede reservar/descontar inventario.
3. **Autorización:** `sales.manage`; logística posterior usa capacidades de rutas.
4. **Scope:** `organization_id` de sesión en acciones, RLS en tablas.
5. **Montos/estado:** payload no confiable.
6. **Idempotencia/transacción:** incompletas.
7. **Huecos:** además de P0-06/P1-01, políticas directas permiten cambios posteriores.

## 9.6 Facturación por caja

1. Cada `shipment_package` recibe código/estado y eventos de ciclo.
2. Triggers sincronizan cambios de shipment y paquete.
3. Entrega/recolección del conductor adjunta evidencia.
4. **Autorización/tenant/org:** las acciones normales recargan la tarea; los helpers SQL no validan nada.
5. **Montos/estado:** estado aceptado por RPC helper.
6. **Idempotencia:** event keys parciales.
7. **Huecos:** P0-03 permite saltarse el flujo completo.

## 9.7 Registro de pagos

1. Flujo antiguo inserta `shipment_payments` y actualiza saldo/estado.
2. Recolección de conductor usa RPC atómico para factura en algunos caminos.
3. Flujo nuevo usa customer/agency payments, applications, asientos y operación idempotente.
4. **Autorización:** acciones/RPC públicos nuevos validan capacidades.
5. **Tenant/organización:** nuevos RPC derivan ámbito; tabla antigua usa org.
6. **Montos:** centavos enteros en modelo nuevo; antiguo usa valores suministrados.
7. **Huecos:** escritura directa de pagos antiguos y helpers financieros anónimos.

## 9.8 Cargo de agencia a matriz

1. `create_agency_sale` resuelve tarifa interna.
2. Inserta `agency_charges` por línea y genera asiento mediante triggers/helpers.
3. Cargo y precio público se mantienen separados.
4. **Autorización/scope:** membresía/tenant/agencia activa.
5. **Monto:** interno server-side; correcto en diseño.
6. **Idempotencia:** key por venta y sufijo por cargo.
7. **Huecos:** helpers internos expuestos permiten falsificar/revertir fuera del comando.

## 9.9 Liberación de caja para envío

1. Se evalúan retenciones/deuda y estado.
2. `authorize_international_release` exige permiso, motivo/evidencia según caso.
3. Trigger financiero impide salida con hold activo.
4. **Autorización/scope:** modelo nuevo deriva tenant/organización.
5. **Estado:** transición esperada por RPC/tareas.
6. **Huecos:** P0-03 puede cambiar estado de paquete; P0-02 puede alterar hechos financieros; se debe probar el circuito integrado.

## 9.10 Entrada a bodega

1. Operador abre sesión de intake para almacén.
2. Escanea código; RPC bloquea/identifica paquete y registra condición, peso y evidencia.
3. La custodia debe seguir con conductor hasta el escaneo exitoso.
4. Se registran items/eventos e idempotency key; cierre/reapertura son comandos.
5. **Autorización:** permiso y acceso a warehouse.
6. **Scope:** organización/warehouse derivados o validados.
7. **Huecos:** contador sin RLS/ACL cerrada y helpers generales de estado expuestos.

## 9.11 Cambio de custodia

1. Usuario autorizado inicia handoff con destinatario, motivo, evidencia y key.
2. Paquete no puede tener otro handoff pendiente.
3. Un segundo usuario con `package.custody.receive` acepta con evidencia.
4. Se registra evento y la vista `package_custody_current` elige el más reciente.
5. **Scope:** organización actual; evidencia no vacía; operación idempotente.
6. **Hueco:** el segundo usuario no tiene que ser `to_holder_id`; P1-03.

## 9.12 Creación y resolución de excepciones

1. Se reporta excepción sobre paquete/tarea con tipo, razón, evidencia y key.
2. `blocks_release` impide determinadas salidas.
3. Resolución propone estado; casos sensibles pasan a `pending_approval`.
4. Aprobador distinto finaliza; eventos son append-only.
5. **Autorización/scope:** permisos y organización en RPC.
6. **Idempotencia:** key al reportar.
7. **Huecos:** auditoría contextual incompleta y cierre diario no consume el bloqueo.

## 9.13 Cierre de agencia

1. `prepare_agency_daily_close` deriva resumen y efectivo esperado.
2. Exige motivo si contado difiere.
3. Persiste snapshot `prepared`.
4. Segundo usuario con permiso finaliza y congela el día; triggers impiden nuevas ventas/pagos del día cerrado.
5. **Scope:** organización agencia actual.
6. **Montos:** centavos enteros y resumen SQL.
7. **Idempotencia:** key en preparación.
8. **Huecos:** finalización no recalcula bajo todas las condiciones ni bloquea excepciones abiertas/bloqueantes.

## 9.14 Ajustes de inventario

1. UI/action valida capacidad y warehouse.
2. Camino recomendado llama `record_inventory_movement_atomic`, registra evidencia/costo y cambia stock bajo transacción.
3. Movimientos son append-only y algunos reversos están modelados.
4. **Scope:** organización y acceso a warehouse.
5. **Monto/cantidad:** enteros y guardas en RPC.
6. **Idempotencia/carrera:** varía según acción; reservas tienen comandos dedicados.
7. **Hueco:** política `inventory_stock ALL` permite evitar el movimiento, modificar/delete stock y romper auditoría.

# 10. Credencial administrativa de pruebas

Existe una credencial administrativa deliberadamente débil en desarrollo. **No se cambió, invalidó, rotó, bloqueó ni reprodujo en este informe.** Debe conservarse temporalmente para las pruebas solicitadas, pero aislada de producción mediante una separación explícita de entorno.

La revisión confirmó que el valor completo está presente en archivos versionados y en el historial Git disponible, incluidos documentación y scripts/seeds. No se encontró evidencia confirmada de que el valor esté embebido como credencial en los chunks cliente inspeccionados; coincidencias de cadenas genéricas se descartaron por contexto. Tampoco se verificaron logs históricos de infraestructura, porque no estaban disponibles.

La implementación futura debe:

- leer la credencial desde un origen local no versionado/secret de CI;
- impedir que scripts de restauración/seed se ejecuten fuera de desarrollo;
- escanear repositorio, historial, bundles, mapas, logs y respuestas sin imprimir el valor;
- no forzar cambio, rotación ni bloqueo mientras siga vigente esta restricción;
- planificar por separado cualquier saneamiento de historial, coordinando clones y despliegues;
- no permitir que este riesgo o su excepción oculten P0-01, P0-05, P0-08 ni otras fallas de autenticación.

# 11. Orden recomendado de corrección

## Fase 0 — Impedir explotación inmediata

1. Actualizar Next a versión corregida.
2. Migración única de ACL: revocar `anon/authenticated/PUBLIC` de helpers administrativos, bootstrap, finanzas y ciclo de paquete; corregir default privileges.
3. Habilitar RLS/revocar CRUD en las tres tablas expuestas.
4. Bloquear autoactualización de rol/campos de scope.
5. Mantener la credencial de pruebas sin rotarla, pero retirar literales de runtime/artefactos mediante separación dev segura.

**Deben hacerse juntos:** ACL + default privileges + pruebas de llamadas internas, para no dejar helpers nuevos expuestos ni romper RPC de negocio.

## Fase 1 — Aislamiento multi-tenant y autorización

1. Corregir política padre-hijo de líneas.
2. Añadir permiso a lectura de visitas.
3. Rediseñar arranque del reloj con organización/PIN/rate limit.
4. Revisar todas las acciones service role con una plantilla común de scope.
5. Agregar gates de catálogo sobre RLS, ACL y `SECURITY DEFINER`.

## Fase 2 — Integridad financiera y transacciones

1. Reemplazar creación antigua por comando transaccional idempotente con precios server-side.
2. Cerrar escritura directa de shipment/payment/stock.
3. Hacer pagos append-only con reversos.
4. Aplicar mínimo/override auditable en venta agencia.
5. Enlazar liberación, hold, factura, custodia e inventario bajo estados explícitos.

**Deben hacerse juntos:** comando de venta + revocación de escritura directa + migración de todos los escritores; revocar primero rompería operación y migrar primero sin revocar mantendría bypass.

## Fase 3 — Validación, archivos y rate limits

1. Límite multipart previo/streaming y errores públicos estables.
2. Magic bytes/re-encode de imágenes.
3. Minimizar seguimiento público y fortalecer token/límites.
4. Decidir privacidad del bucket público.
5. Allowlist de origen y CSRF explícito.

## Fase 4 — Headers, dependencias y endurecimiento

1. CSP gradual, HSTS, frame-ancestors, referrer/permissions policy, no-store.
2. Resolver `sharp`, `brace-expansion`, `exceljs/uuid`.
3. Sesiones/Signup/MFA por configuración de producción.
4. TTL/limpieza de datos offline y URLs.

## Fase 5 — Pruebas automatizadas y monitoreo

1. Matriz de dos tenants/dos agencias/roles.
2. Tests de catálogo RLS/ACL/funciones.
3. Tests de concurrencia, idempotencia, pagos, cierre y custodia.
4. DAST de endpoints públicos y archivos.
5. Alertas y auditoría uniforme, con secretos redactados.

# 12. Lista de archivos que deberá revisar o modificar Cursor

| Ruta exacta | Motivo | Hallazgo | Tipo probable | Riesgo de regresión |
|---|---|---|---|---|
| `supabase/migrations/001_roles_permissions_warehouses.sql` + nueva migración | política perfil/stock | P0-05/P0-07 | trigger, columnas, RLS | alto |
| `supabase/migrations/003_platform_admin.sql` + nueva migración | grant admin | P0-01 | ACL/guarda | alto |
| `supabase/migrations/009_bootstrap_phone_overload.sql` | overload bootstrap | P0-01 | retirar/revocar firma | alto |
| `supabase/migrations/067_distribution_acquisition_owners.sql` | bootstrap actual | P0-01 | ACL | medio |
| `supabase/migrations/071_agency_finance_accounting.sql` | helpers, reversos, defaults | P0-02/P0-04 | ACL/esquema privado | alto |
| `supabase/migrations/082_package_invoice_lifecycle.sql` | helpers de estado | P0-03 | autorización/transiciones | alto |
| `supabase/migrations/083_agency_route_operations.sql` | tabla sin RLS | P0-04 | RLS/ACL | medio |
| `supabase/migrations/087_controlled_operations.sql` | cierre/excepciones | P1-04 | invariant/override | medio |
| `supabase/migrations/092_package_custody_timeline.sql` | receptor handoff | P1-03 | validar destinatario | medio |
| `supabase/migrations/094_commercial_configuration_inheritance.sql` | precio agencia | P1-05 | mínimo/override | medio |
| `supabase/migrations/097_agency_request_scope_guard.sql` | scope línea-padre | P1-07 | trigger/FK/policy | bajo |
| `supabase/migrations/117_warehouse_intake_sessions.sql` | contador sin RLS | P0-04 | RLS/ACL/RPC | medio |
| nueva migración de hardening ACL | corregir estado efectivo y defaults | P0-01/02/03/04 | `REVOKE`, grants exactos, gates | alto |
| `src/app/actions/shipments.ts` | venta antigua | P0-06/P1-01 | sustituir por RPC | alto |
| `src/app/actions/agency-operations.ts` | visitas conductor | P1-06 | permiso/scope | bajo |
| `src/app/actions/time-clock.ts` | login reloj global | P1-08 | auth terminal/PIN | medio |
| `src/app/actions/conductor-tasks.ts` | archivos y errores | P1-10/P2-06 | validación/streaming | medio |
| `src/app/api/conductor/task-results/route.ts` | multipart/error crudo | P1-10 | límite/respuesta | bajo |
| `src/app/api/public/tracking/route.ts` | PII pública | P1-02 | contrato/token | medio |
| `src/lib/public-tracking.ts` | mapeo excesivo | P1-02 | minimización | medio |
| `src/lib/security/api-guards.ts` | límites | P1-02/P2-04 | claves/fail behavior | medio |
| `src/lib/security/request-ip.ts` | proxy headers | P1-02/P2-04 | trusted proxy | medio |
| `src/lib/http/request-origin.ts` | Host no confiable | P2-01 | allowlist | medio |
| `src/lib/auth/access.ts`, `src/lib/auth/require.ts` | ruta reloj/capacidades | P1-08 | permisos | medio |
| `src/lib/supabase/admin.ts` y llamadores | service role | transversal | helper scoped/telemetría | alto |
| `src/lib/distribution/metrics.ts` | sobrelectura global | P2/P3 | filtrar en query | bajo |
| `public/sw.js`, `src/lib/conductor-offline/queue.ts` | datos residuales | P2-07 | TTL/limpieza | medio |
| `next.config.ts` | headers/source maps/cache | P2-02 | headers/CSP | medio |
| `supabase/config.toml` y config desplegada | Auth/sesiones | P2-10 | separación entorno | alto |
| `package.json`, `package-lock.json` | dependencias | P0-08/P2-03 | upgrades | medio |
| `AGENTS.md`, `.cursor/rules/no-password-reset.mdc`, `DESARROLLO-LOCAL.md`, scripts de prueba/seed | literal dev | P1-09 | referencia a secreto local, sin rotar | alto |
| tests bajo `src/lib/*.test.ts`, `*.eval.test.ts`, `scripts/` | regresión | todos | nuevos gates/escenarios | bajo |

# 13. Pruebas de seguridad necesarias

1. **Acceso entre tenants:** dos tenants, mismos UUID-shaped inputs; SELECT/INSERT/UPDATE/DELETE/RPC deben negar cruce.
2. **Acceso entre agencias:** admin/vendedor A no ve ni modifica B; matriz solo con capacidad y delegación.
3. **Escalada de roles:** PATCH directo a perfil no cambia rol/org/tenant; no se puede insertar `role_permissions`.
4. **ACL anónimas:** enumerar todas las funciones definer y fallar si `anon` ejecuta mutadores internos; exact signatures.
5. **Tablas RLS:** gate que toda tabla pública nueva tenga RLS antes de grant; deny directo en tablas de hechos.
6. **Service role:** cada acción con admin client prueba sesión ausente, rol incorrecto, ID ajeno y org ajena.
7. **Manipulación de precios:** alterar cada campo cliente; total, impuestos/descuentos/costo/estado se derivan en servidor.
8. **Pagos duplicados/negativos:** doble clic, mismo/diferente key, concurrencia, overpayment, cero, negativo y reverso.
9. **Idempotencia:** replay devuelve mismo resultado sin segundo cargo/stock/evento; key de otro actor se rechaza.
10. **Cierres congelados:** venta/pago retroactivo denegado; excepción bloqueante impide cierre; override dual auditable.
11. **Custodia:** iniciador no recibe, tercero no recibe, receptor designado sí; replay y evidencia obligatoria.
12. **Estados inválidos de cajas:** tabla de transición completa; helper interno inaccesible; actor/hora no falsificables.
13. **Bodega:** scan duplicado, dos sesiones concurrentes, paquete no esperado/encontrado, almacén ajeno y contador concurrente.
14. **Inventario negativo:** dos reservas simultáneas, ajuste directo denegado, movimiento/reverso inseparable del stock.
15. **Subida de archivos:** límite antes del parseo, magic bytes, MIME falso, polyglot, SVG/HTML, corrupto, ruta y cross-org.
16. **XSS:** nombres/notas/direcciones/evidencias con payload; renderizado escapado; CSP report-only y luego enforcement.
17. **CSRF/CORS:** Origin ajeno, subdominio, preflight, cookies SameSite y Server Actions.
18. **Rate limiting:** presupuesto por IP/cuenta/recurso, header spoof, concurrencia, backend caído y ventanas.
19. **Seguimiento público:** entropía, enumeración, PII enmascarada, token expirado/revocado y caché.
20. **Auditoría inmutable:** update/delete/insert falso denegado; cada comando crítico registra actor real, scope, antes/después y motivo.
21. **Sesiones:** fixation, refresh rotation, logout/revocación, expiración, sesión robada, cookies prod y limpieza offline.
22. **Dependencias/Next:** casos de proxy bypass, Server Actions, SSRF, cache confusion e imágenes tras upgrade.
23. **Secretos:** escaneo de árbol, commits, artefactos y logs con comparación segura/redactada; nunca imprimir el valor.

Estado de comprobaciones ejecutadas durante la auditoría:

- `npm run db:check`: **correcto**, 127 migraciones y tablas esperadas.
- `npm run test:gate`: **920/922 pasan**; fallan 2 pruebas de navegación/legibilidad existentes.
- `npm run test:eval`: **471/476 pasan**; fallan 5 pruebas existentes de hidratación y programación logística.
- `npm run lint`: **falla** con 2 errores `react-hooks/set-state-in-effect` y 4 advertencias de variables no usadas.
- `npm audit --omit=dev`: **5 vulnerabilidades** (3 altas, 2 moderadas).

Estas fallas de línea base no fueron corregidas ni atribuidas a cambios de esta auditoría.

# 14. Información para el prompt de implementación

## `PROMPT_INPUT_FOR_CHATGPT`

```text
OBJETIVO
Endurecer incrementalmente Boxario/Paquetería X, Next 16 + Supabase/PostgreSQL multi-tenant, sin reescritura y preservando operación de matriz, agencias, ventas, pagos, inventario, bodega, rutas, conductores, custodia, offline y seguimiento.

ARQUITECTURA
- App Router, React, Supabase Auth/SSR, PostgreSQL RLS, Storage.
- Sesión y navegación: src/proxy.ts, src/lib/auth/*.
- Acciones: src/app/actions/*; APIs: auth, conductor, public tracking, address.
- Modelo antiguo: organizations/profiles/shipments/shipment_payments/inventory.
- Modelo nuevo: business_tenants/organization_memberships/agencies/sales/invoices/charges/payments/journal/holds.
- Muchos comandos usan SECURITY DEFINER o service role y por ello deben autorizar y derivar scope internamente.

P0 CONFIRMADOS/PRIORITARIOS
1. ACL efectivas permiten a anon ejecutar grant_platform_admin, overloads bootstrap e inicializadores.
2. anon ejecuta helpers finance_audit/complete/post/reverse y puede alterar/fabricar contabilidad/auditoría.
3. anon ejecuta record_shipment_package_invoice_event/state sin auth/scope y puede falsificar estado/actor.
4. agency_route_proposals, driver_settlement_reversals y warehouse_intake_counters no tienen RLS y tienen CRUD anon.
5. profiles_update permite al usuario cambiar su role_id.
6. createShipmentAction confía precio, pago y estados del navegador; finalize usa total no autoritativo.
7. RLS permite mutación directa de shipments, shipment_payments e inventory_stock, evitando eventos/reversos.
8. next 16.2.10 está afectado por bypass de Proxy y fallas de Server Actions; subir al menos a 16.2.11.

P1
- Creación de shipment no transaccional/idempotente.
- Tracking público expone PII/finanzas con factor débil y rate limit evadible.
- Custodia exige segundo actor, pero no receptor designado.
- Cierre diario no bloquea excepciones abiertas/bloqueantes.
- Venta agencia admite publicAmountCents por debajo del mínimo.
- listConductorAgencyVisitsAction permite a no conductores consultar otro driver sin routes.view.
- Política de agency_service_request_lines contiene tautologías padre-hijo.
- Reloj crea sesión por Employee ID global sin org/PIN/rate limit.
- Credencial admin dev débil está versionada e histórica; NO rotarla/cambiarla/bloquearla.
- Multipart conductor se parsea antes del límite y devuelve error.message.

P2
- Host/X-Forwarded-Host sin allowlist.
- Faltan CSP/HSTS/frame-ancestors/referrer/permissions/no-store global.
- sharp, brace-expansion y exceljs/uuid vulnerables.
- Rate limits fallan abiertos y carecen de presupuestos independientes.
- inventory-item-photos es público.
- Uploads solo validan MIME declarado; falta magic-byte/decode/re-encode.
- Cache/IndexedDB offline retiene PII/evidencia local.
- Auditoría incompleta y fabricable por helper expuesto.
- Errores DB se propagan.
- Config Auth local: signup, password mínimo 6, sin MFA/timeouts; producción debe verificarse.

CAMBIOS QUE DEBEN IR JUNTOS
- Nueva migración: corregir default privileges; revocar por firma de PUBLIC/anon/authenticated todos los helpers internos; grants mínimos; habilitar RLS en 3 tablas; pruebas de catálogo.
- Proteger campos profile + cerrar escritura directa financiera/stock al mismo tiempo que se migran todos los escritores a comandos.
- Reemplazar creación de venta/envío por RPC transaccional idempotente server-priced; pagos append-only con reversos.
- Corregir scope padre-hijo, permisos de visitas y login de reloj.
- Fortalecer tracking, rate limits, archivos, origen/CSRF y headers.

ARCHIVOS PRINCIPALES
supabase/migrations/001,003,009,067,071,082,083,087,092,094,097,117 y una nueva migración de hardening;
src/app/actions/shipments.ts, agency-operations.ts, time-clock.ts, conductor-tasks.ts;
src/app/api/conductor/task-results/route.ts, public/tracking/route.ts;
src/lib/public-tracking.ts, security/api-guards.ts, security/request-ip.ts, http/request-origin.ts, auth/*, supabase/admin.ts;
public/sw.js, conductor offline queue, next.config.ts, supabase/config.toml, package files.

RESTRICCIONES FUNCIONALES
- No romper acceso admin de pruebas ni cambiar/inutilizar la credencial débil.
- No mostrar esa contraseña; aislarla exclusivamente a dev y quitar exposición de runtime/repositorio futuro mediante secret local.
- Preservar centavos enteros, separación dinero cliente/tarifa matriz, pagos pendientes fuera de caja.
- Mantener custodia con conductor hasta escaneo físico exitoso en bodega.
- Mantener confirmación explícita de llegada/cierre, operación offline/idempotencia y módulos opcionales.
- No borrar historia financiera; usar reversos.

MIGRACIONES
- Siempre aditivas y revisables; no editar historia desplegada como única corrección.
- ACL exactas por overload, default privileges seguros, RLS/policies/column guards/triggers.
- Comandos transaccionales para venta, pago, stock/custodia.
- Invariantes de receptor, cierre/excepciones, mínimo de agencia.

PRUEBAS OBLIGATORIAS
- Dos tenants/dos agencias/todos los roles; RLS CRUD/RPC; ACL anon.
- Autoescalada, service role con IDs ajenos, precio/pago alterado.
- Replay/concurrencia, pago duplicado, cierre congelado, hold/liberación.
- Custodia destinatario, bodega scan, paquete estados e inventario negativo.
- Upload real/falso/polyglot/límite; XSS/CSRF/CORS/rate limit/tracking.
- Auditoría append-only con actor/scope/diff y secret scan redactado.
- Reejecutar db:check, gate, eval, lint, build y audit; distinguir fallas baseline.

RIESGOS DE REGRESIÓN
Altos: ACL de helpers usados por RPC, onboarding/bootstrap, venta antigua, pagos y stock.
Medios: tracking, kiosco reloj, custodia colectiva, CSP, uploads y upgrade Next/Excel.
Implementar por fases con gates antes de revocar caminos antiguos.
```

## Completitud y limitaciones

La auditoría fue completa respecto del repositorio y de la base **local conectada** disponibles el 2026-07-22. No se afirmó seguridad para componentes que no pudieron observarse.

Limitaciones:

1. No se accedió a Supabase/hosting/CDN/WAF/secret manager de producción; sus Auth settings, RLS desplegada, headers, logs y buckets pueden diferir.
2. No se realizó pentest activo contra producción ni explotación destructiva local; los P0 SQL se verificaron mediante definiciones, ACL y catálogo, no mutando datos.
3. No se ejecutaron migraciones ni tests DB de negocio que escriben/resetearían datos.
4. No se generó build de producción porque habría modificado artefactos del checkout; se inspeccionaron chunks existentes y fuentes.
5. Solo se revisó el historial Git presente en este clon; forks, caches CI, releases y logs externos no estuvieron disponibles.
6. No se inspeccionó tráfico TLS, firewall, proxy real, backups ni controles del sistema operativo.
7. No se validó entregabilidad/seguridad de proveedores externos (Google/SMS/correo) con credenciales reales.
8. Las suites y lint ya estaban fallando; sus fallas se registraron como baseline y no se corrigieron.
