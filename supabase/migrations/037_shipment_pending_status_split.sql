-- Split generic "Pendiente" into explicit pre-transit pending statuses.

update public.shipments
set status = 'Pendiente recolección caja llena'
where status = 'Pendiente'
  and sale_kind = 'full'
  and empty_box_delivered_at is not null;

update public.shipments
set status = 'Pendiente entrega caja vacía'
where status = 'Pendiente';

alter table public.shipments
  alter column status set default 'Pendiente entrega caja vacía';
