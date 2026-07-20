-- Merge inventory categories that only differ by case/whitespace and enforce
-- normalized uniqueness per organization.

do $$
declare
  group_row record;
  canonical_id uuid;
  dupe_id uuid;
  merged_tree jsonb;
begin
  for group_row in
    select
      organization_id,
      lower(trim(regexp_replace(name, '\s+', ' ', 'g'))) as norm_name,
      array_agg(
        id
        order by
          (select count(*)::int from public.inventory_items ii where ii.category_id = inventory_categories.id) desc,
          jsonb_array_length(tree_data) desc,
          case when name <> lower(name) then 0 else 1 end,
          created_at asc
      ) as category_ids,
      array_agg(
        name
        order by
          (select count(*)::int from public.inventory_items ii where ii.category_id = inventory_categories.id) desc,
          jsonb_array_length(tree_data) desc,
          case when name <> lower(name) then 0 else 1 end,
          created_at asc
      ) as category_names
    from public.inventory_categories
    group by organization_id, lower(trim(regexp_replace(name, '\s+', ' ', 'g')))
    having count(*) > 1
  loop
    canonical_id := group_row.category_ids[1];

    select coalesce(
      nullif(
        (select tree_data from public.inventory_categories where id = canonical_id),
        '[]'::jsonb
      ),
      (
        select ic.tree_data
        from public.inventory_categories ic
        where ic.id = any(group_row.category_ids)
          and jsonb_array_length(ic.tree_data) > 0
        order by jsonb_array_length(ic.tree_data) desc
        limit 1
      ),
      '[]'::jsonb
    )
    into merged_tree;

    update public.inventory_categories
    set
      name = (
        select candidate_name
        from unnest(group_row.category_names) as candidate_name
        order by
          case when candidate_name <> lower(candidate_name) then 0 else 1 end,
          length(candidate_name) desc
        limit 1
      ),
      tree_data = merged_tree
    where id = canonical_id;

    for i in 2..coalesce(array_length(group_row.category_ids, 1), 0) loop
      dupe_id := group_row.category_ids[i];

      update public.inventory_items
      set category_id = canonical_id
      where category_id = dupe_id;

      delete from public.inventory_categories
      where id = dupe_id;
    end loop;
  end loop;
end $$;

alter table public.inventory_categories
  drop constraint if exists inventory_categories_organization_id_name_key;

create unique index if not exists idx_inventory_categories_org_name_normalized
  on public.inventory_categories (
    organization_id,
    lower(trim(regexp_replace(name, '\s+', ' ', 'g')))
  );
