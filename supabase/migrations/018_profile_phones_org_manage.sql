-- Gestores de usuarios pueden ver teléfonos de recuperación del equipo.

create policy profile_phones_org_manage on public.profile_phones
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = profile_phones.profile_id
        and p.organization_id = public.current_organization_id()
        and public.user_has_permission('users.manage')
    )
  );
