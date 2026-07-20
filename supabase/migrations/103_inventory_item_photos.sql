-- Product-type photos for inventory leaves (e.g. all 14x14x14 boxes share one image).

alter table public.inventory_items
  add column if not exists photo_url text not null default '';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inventory-item-photos',
  'inventory-item-photos',
  true,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists inventory_item_photos_select on storage.objects;
create policy inventory_item_photos_select on storage.objects for select
  using (
    bucket_id = 'inventory-item-photos'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and public.user_has_permission('inventory.view')
  );

drop policy if exists inventory_item_photos_insert on storage.objects;
create policy inventory_item_photos_insert on storage.objects for insert
  with check (
    bucket_id = 'inventory-item-photos'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and (
      public.user_has_permission('inventory.adjust')
      or public.user_has_permission('sales.manage')
    )
  );

drop policy if exists inventory_item_photos_update on storage.objects;
create policy inventory_item_photos_update on storage.objects for update
  using (
    bucket_id = 'inventory-item-photos'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and (
      public.user_has_permission('inventory.adjust')
      or public.user_has_permission('sales.manage')
    )
  )
  with check (
    bucket_id = 'inventory-item-photos'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and (
      public.user_has_permission('inventory.adjust')
      or public.user_has_permission('sales.manage')
    )
  );

drop policy if exists inventory_item_photos_delete on storage.objects;
create policy inventory_item_photos_delete on storage.objects for delete
  using (
    bucket_id = 'inventory-item-photos'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and (
      public.user_has_permission('inventory.adjust')
      or public.user_has_permission('sales.manage')
    )
  );
