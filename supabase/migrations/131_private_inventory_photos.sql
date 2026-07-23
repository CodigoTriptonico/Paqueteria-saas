-- Inventory photos are tenant-private and served only through short signed URLs.

update storage.buckets
set public = false,
    file_size_limit = 4194304,
    allowed_mime_types = array['image/webp']
where id = 'inventory-item-photos';

drop policy if exists inventory_item_photos_select on storage.objects;
create policy inventory_item_photos_select on storage.objects
for select to authenticated
using (
  bucket_id = 'inventory-item-photos'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
  and public.user_has_permission('inventory.view')
);

drop policy if exists inventory_item_photos_insert on storage.objects;
create policy inventory_item_photos_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'inventory-item-photos'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
  and (
    public.user_has_permission('inventory.adjust')
    or public.user_has_permission('sales.manage')
  )
);

drop policy if exists inventory_item_photos_update on storage.objects;
create policy inventory_item_photos_update on storage.objects
for update to authenticated
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
create policy inventory_item_photos_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'inventory-item-photos'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
  and (
    public.user_has_permission('inventory.adjust')
    or public.user_has_permission('sales.manage')
  )
);
