-- Custom contact channel label when channel = 'other'.

alter table public.shipment_contact_logs
  add column if not exists channel_other text not null default '';

update public.shipment_contact_logs
set channel_other = 'Sin especificar'
where channel = 'other'
  and length(trim(channel_other)) = 0;

alter table public.shipment_contact_logs
  drop constraint if exists shipment_contact_logs_channel_other_check;

alter table public.shipment_contact_logs
  add constraint shipment_contact_logs_channel_other_check check (
    length(channel_other) <= 80
    and (
      (channel = 'other' and length(trim(channel_other)) > 0)
      or (channel <> 'other' and channel_other = '')
    )
  );

create index if not exists idx_shipment_contact_logs_channel_other
  on public.shipment_contact_logs (organization_id, channel_other)
  where channel = 'other' and length(trim(channel_other)) > 0;
