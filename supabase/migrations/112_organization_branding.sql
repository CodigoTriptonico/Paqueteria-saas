insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-logos',
  'organization-logos',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists organization_logos_select on storage.objects;
create policy organization_logos_select on storage.objects for select
  using (
    bucket_id = 'organization-logos'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and public.user_has_permission('settings.manage')
  );

drop policy if exists organization_logos_insert on storage.objects;
create policy organization_logos_insert on storage.objects for insert
  with check (
    bucket_id = 'organization-logos'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and public.user_has_permission('settings.manage')
  );

drop policy if exists organization_logos_update on storage.objects;
create policy organization_logos_update on storage.objects for update
  using (
    bucket_id = 'organization-logos'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and public.user_has_permission('settings.manage')
  )
  with check (
    bucket_id = 'organization-logos'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and public.user_has_permission('settings.manage')
  );

drop policy if exists organization_logos_delete on storage.objects;
create policy organization_logos_delete on storage.objects for delete
  using (
    bucket_id = 'organization-logos'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and public.user_has_permission('settings.manage')
  );
