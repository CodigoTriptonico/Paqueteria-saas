-- Audited profile mutations live behind one tenant-scoped command.

create or replace function public.save_commercial_entity_profile(
  target_entity_type text,
  target_entity_id uuid,
  profile_patch jsonb,
  idempotency_key text
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  tenant_value uuid := public.current_tenant_id(); matrix_value uuid := public.current_business_organization_id();
  membership_value uuid := public.current_membership_id(); previous_row public.commercial_entity_profiles; profile_id uuid;
  country_code_value text := upper(btrim(coalesce(profile_patch->>'countryCode','')));
  enabled_services_value text[];
begin
  if not public.current_membership_has_permission('commercial.settings.manage',tenant_value,matrix_value) then raise exception 'FORBIDDEN'; end if;
  if target_entity_type not in ('agency','seller') or nullif(btrim(idempotency_key),'') is null then raise exception 'COMMERCIAL_PROFILE_INVALID'; end if;
  if target_entity_type='agency' and not exists(select 1 from public.agencies where id=target_entity_id and tenant_id=tenant_value and matrix_organization_id=matrix_value and archived_at is null) then raise exception 'COMMERCIAL_ENTITY_NOT_FOUND'; end if;
  if target_entity_type='seller' and not exists(select 1 from public.profiles profile join public.roles role on role.id=profile.role_id where profile.id=target_entity_id and profile.organization_id=matrix_value and role.slug='vendedor' and profile.archived_at is null) then raise exception 'COMMERCIAL_ENTITY_NOT_FOUND'; end if;
  if country_code_value<>'' and not exists(select 1 from public.pricing_countries where organization_id=matrix_value and upper(code)=country_code_value) then raise exception 'COMMERCIAL_COUNTRY_NOT_FOUND'; end if;
  if nullif(profile_patch->>'warehouseId','') is not null and not exists(select 1 from public.warehouses where id=(profile_patch->>'warehouseId')::uuid and organization_id=matrix_value) then raise exception 'COMMERCIAL_WAREHOUSE_NOT_FOUND'; end if;
  if profile_patch ? 'enabledServices' then
    if jsonb_typeof(profile_patch->'enabledServices')<>'array' then raise exception 'COMMERCIAL_SERVICES_INVALID'; end if;
    select coalesce(array_agg(value),array[]::text[]) into enabled_services_value from jsonb_array_elements_text(profile_patch->'enabledServices') value;
  else enabled_services_value := array['international_shipping']::text[]; end if;
  if exists(select 1 from unnest(enabled_services_value) service where service not in ('international_shipping','home_delivery','home_pickup','empty_box')) then raise exception 'COMMERCIAL_SERVICES_INVALID'; end if;

  select * into previous_row from public.commercial_entity_profiles where tenant_id=tenant_value and matrix_organization_id=matrix_value and entity_type=target_entity_type and entity_id=target_entity_id for update;
  insert into public.commercial_entity_profiles(
    tenant_id,matrix_organization_id,entity_type,entity_id,country_code,warehouse_id,zone,territory,visit_frequency,
    operational_status,enabled_services,can_modify_public_price,max_discount_bps,address,contact,logistics_options,
    created_by_membership_id,updated_by_membership_id
  ) values(
    tenant_value,matrix_value,target_entity_type,target_entity_id,country_code_value,nullif(profile_patch->>'warehouseId','')::uuid,
    left(coalesce(profile_patch->>'zone',''),200),left(coalesce(profile_patch->>'territory',''),200),left(coalesce(profile_patch->>'visitFrequency',''),100),
    coalesce(nullif(profile_patch->>'operationalStatus',''),'active'),enabled_services_value,coalesce((profile_patch->>'canModifyPublicPrice')::boolean,false),
    greatest(0,least(10000,coalesce((profile_patch->>'maxDiscountBps')::integer,0))),coalesce(profile_patch->'address','{}'::jsonb),
    coalesce(profile_patch->'contact','{}'::jsonb),coalesce(profile_patch->'logisticsOptions','{}'::jsonb),membership_value,membership_value
  ) on conflict(tenant_id,matrix_organization_id,entity_type,entity_id) do update set
    country_code=excluded.country_code,warehouse_id=excluded.warehouse_id,zone=excluded.zone,territory=excluded.territory,
    visit_frequency=excluded.visit_frequency,operational_status=excluded.operational_status,enabled_services=excluded.enabled_services,
    can_modify_public_price=excluded.can_modify_public_price,max_discount_bps=excluded.max_discount_bps,address=excluded.address,
    contact=excluded.contact,logistics_options=excluded.logistics_options,updated_by_membership_id=membership_value,updated_at=now()
  returning id into profile_id;
  insert into public.immutable_audit_events(tenant_id,organization_id,actor_user_id,actor_membership_id,action,entity_type,entity_id,before_state,after_state,idempotency_key,metadata)
  values(tenant_value,matrix_value,auth.uid(),membership_value,'commercial.profile.changed',target_entity_type,target_entity_id,
    case when previous_row.id is null then '{}'::jsonb else to_jsonb(previous_row) end,profile_patch,btrim(idempotency_key),jsonb_build_object('level','entity','commercialProfileId',profile_id));
  return jsonb_build_object('profileId',profile_id);
end;
$$;

grant execute on function public.save_commercial_entity_profile(text,uuid,jsonb,text) to authenticated;
