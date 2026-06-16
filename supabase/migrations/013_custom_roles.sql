-- Permitir roles personalizados por organizacion

create policy roles_insert on public.roles for insert
  with check (
    organization_id = public.current_organization_id()
    and public.user_has_permission('permissions.manage')
    and is_system = false
  );

create policy roles_delete on public.roles for delete
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('permissions.manage')
    and is_system = false
  );
