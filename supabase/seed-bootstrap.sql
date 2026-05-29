-- Ejecutar UNA VEZ en Supabase SQL Editor despues de la migracion principal.
-- Crea organizacion demo, roles y vincula al usuario admin que ya existe en Auth.

-- 1) Crear organizacion
insert into public.organizations (name, slug)
values ('Mi Paqueteria', 'mi-paqueteria')
on conflict (slug) do nothing;

-- 2) Sembrar roles y bodega principal
select public.seed_organization_roles(
  (select id from public.organizations where slug = 'mi-paqueteria')
);

-- 3) Vincular tu usuario (reemplaza el email)
-- insert into public.profiles (id, organization_id, role_id, email, full_name)
-- select
--   u.id,
--   o.id,
--   r.id,
--   u.email,
--   'Administrador'
-- from auth.users u
-- cross join public.organizations o
-- cross join public.roles r
-- where u.email = 'admin@ejemplo.com'
--   and o.slug = 'mi-paqueteria'
--   and r.slug = 'administrador'
-- on conflict (id) do nothing;
