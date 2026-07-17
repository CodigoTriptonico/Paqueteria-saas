# Tenencia empresarial de Boxario

## Resultado medible

La migración `070_business_tenants_agencies.sql` fija tres invariantes comprobables:

- una identidad tiene como máximo una membresía empresarial activa;
- una agencia, su matriz y toda asignación histórica comparten el mismo `tenant_id` por claves foráneas compuestas;
- las tablas nuevas no aceptan escritura directa autenticada y el historial crítico no se puede actualizar ni borrar.

La meta operativa es `0` accesos entre tenants, `0` membresías activas duplicadas y `0` eventos de auditoría reescritos.

## Jerarquía

`business_tenants` representa SCGS, Enviamgs y futuros clientes. Boxario sigue siendo `organizations.kind = 'platform'` y mantiene `tenant_id = NULL`.

Dentro de cada tenant:

- una organización `matrix` se referencia a sí misma mediante `matrix_organization_id`;
- cada organización `agency` referencia la matriz canónica del tenant;
- `agencies` contiene el ciclo comercial y enlaza temporalmente `distribution_partners` mediante `legacy_distribution_partner_id`.

El backfill usa el UUID de la matriz como UUID del tenant. El resultado no depende de nombres ni del orden de ejecución. Una organización presente como distribuidor se incorpora como agencia del tenant de su matriz y no genera un tenant huérfano.

## Identidad y alcance

`organization_memberships` conserva el rol y su snapshot histórico. El índice parcial sobre `user_id` impide dos membresías activas al mismo tiempo. Los alcances disponibles son `tenant`, `organization`, `team`, `portfolio` y `assigned_resource`.

La sesión determina `membership_id`, `tenant_id` y `organization_id` mediante `auth.uid()`. Ninguna función de autorización acepta un tenant elegido por el navegador como fuente de identidad. `tenant_organization_access` abre únicamente:

- el tenant completo para una membresía de alcance `tenant`;
- la propia organización;
- las agencias activamente asignadas al captador;
- las carteras de captadores activos del supervisor;
- una delegación de soporte vigente y con permisos explícitos.

## Historia y correcciones

Las asignaciones de captador y supervisor terminan con `ended_at`; no se reemplazan ni se borran. `agency_status_history` usa una versión creciente por agencia. `immutable_audit_events` registra actor, membresía, antes, después, motivo, request e idempotencia y rechaza `UPDATE` y `DELETE`.

Los tenants, organizaciones empresariales, perfiles con membresía, membresías y agencias tampoco se borran físicamente. Se desactivan, suspenden o cierran. El registro de idempotencia conserva un resultado único por `(tenant_id, operation_type, idempotency_key)`.

## Compatibilidad y orden de despliegue

La migración es aditiva. `distribution_*`, `profiles.organization_id`, los roles y las políticas anteriores siguen disponibles durante escritura dual. Las nuevas operaciones deben usar `organization_memberships`, `agencies`, `immutable_audit_events` e `idempotency_operations`.

Aplicación local:

```powershell
npm.cmd run db:inspect
npm.cmd run db:apply
npm.cmd run db:check
```

No requiere reiniciar Next.js. Si el proceso de desarrollo mantiene metadatos de Supabase en memoria, reiniciar `npm.cmd run dev` después de aplicar la migración.

## Fallos que detienen el despliegue

La migración falla antes del corte si una organización distribuidora aparece bajo más de una matriz o si una matriz es a su vez agencia. Esos casos no tienen una asignación de tenant inequívoca y se deben corregir con evidencia antes de reintentar.
