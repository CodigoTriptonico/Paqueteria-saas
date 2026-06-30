-- Hitos de tiempo por envío: columnas consultables + backfill desde auditoría y datos existentes.

alter table public.shipments
  add column if not exists empty_box_delivered_at timestamptz,
  add column if not exists full_box_collected_at timestamptz,
  add column if not exists office_received_at timestamptz,
  add column if not exists departed_at timestamptz,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

-- Caja vacía: plan logístico (mostrador) o tarea de entrega
update public.shipments s
set empty_box_delivered_at = src.recorded_at
from (
  select
    s2.id as shipment_id,
    coalesce(
      nullif(trim(s2.logistics_plan #>> '{emptyBox,stockDeductedAt}'), '')::timestamptz,
      (
        select min(coalesce(t.completed_at, t.stock_deducted_at))
        from public.shipment_logistics_tasks t
        where t.shipment_id = s2.id
          and t.task_type = 'deliver_empty_box'
          and coalesce(t.completed_at, t.stock_deducted_at) is not null
      )
    ) as recorded_at
  from public.shipments s2
  where s2.empty_box_delivered_at is null
) src
where s.id = src.shipment_id
  and src.recorded_at is not null;

-- Caja llena: tarea de recolección completada
update public.shipments s
set full_box_collected_at = src.recorded_at
from (
  select
    t.shipment_id,
    min(t.completed_at) as recorded_at
  from public.shipment_logistics_tasks t
  where t.task_type = 'pickup_full_box'
    and t.completed_at is not null
  group by t.shipment_id
) src
where s.id = src.shipment_id
  and s.full_box_collected_at is null
  and src.recorded_at is not null;

-- Estados operativos: primera ocurrencia en activity_history
update public.shipments s
set office_received_at = src.recorded_at
from (
  select
    h.entity_id as shipment_id,
    min(h.created_at) as recorded_at
  from public.activity_history h
  where h.entity_type = 'shipment'
    and h.action = 'shipment.status_updated'
    and h.metadata ->> 'nextStatus' = 'En oficina'
  group by h.entity_id
) src
where s.id = src.shipment_id
  and s.office_received_at is null;

update public.shipments s
set departed_at = src.recorded_at
from (
  select
    h.entity_id as shipment_id,
    min(h.created_at) as recorded_at
  from public.activity_history h
  where h.entity_type = 'shipment'
    and h.action = 'shipment.status_updated'
    and h.metadata ->> 'nextStatus' = 'Pickup'
  group by h.entity_id
) src
where s.id = src.shipment_id
  and s.departed_at is null;

update public.shipments s
set shipped_at = src.recorded_at
from (
  select
    h.entity_id as shipment_id,
    min(h.created_at) as recorded_at
  from public.activity_history h
  where h.entity_type = 'shipment'
    and h.action = 'shipment.status_updated'
    and h.metadata ->> 'nextStatus' = 'Enviado'
  group by h.entity_id
) src
where s.id = src.shipment_id
  and s.shipped_at is null;

update public.shipments s
set delivered_at = src.recorded_at
from (
  select
    h.entity_id as shipment_id,
    min(h.created_at) as recorded_at
  from public.activity_history h
  where h.entity_type = 'shipment'
    and h.action = 'shipment.status_updated'
    and h.metadata ->> 'nextStatus' = 'Entregado'
  group by h.entity_id
) src
where s.id = src.shipment_id
  and s.delivered_at is null;

-- Oficina con caja llena traída por cliente: si ya está en oficina pero sin full_box_collected_at
update public.shipments s
set full_box_collected_at = s.office_received_at
where s.full_box_collected_at is null
  and s.office_received_at is not null
  and s.sale_kind = 'full'
  and coalesce(s.logistics_plan #>> '{fullBox,mode}', '') = 'Cliente trae caja llena a oficina';
