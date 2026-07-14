-- Merge duplicate inventory leaf items and prevent new duplicates.

do $$
declare
  group_row record;
  canonical_id uuid;
  dupe_id uuid;
  stock_rec record;
  canonical_stock_id uuid;
begin
  for group_row in
    select
      organization_id,
      category_id,
      kind,
      coalesce(subcategory, '') as subcategory_key,
      array_agg(id order by created_at asc) as item_ids
    from public.inventory_items
    group by organization_id, category_id, kind, coalesce(subcategory, '')
    having count(*) > 1
  loop
    canonical_id := group_row.item_ids[1];

    for i in 2..coalesce(array_length(group_row.item_ids, 1), 0) loop
      dupe_id := group_row.item_ids[i];

      for stock_rec in
        select *
        from public.inventory_stock
        where item_id = dupe_id
      loop
        select id
        into canonical_stock_id
        from public.inventory_stock
        where warehouse_id = stock_rec.warehouse_id
          and item_id = canonical_id
        limit 1;

        if canonical_stock_id is not null then
          update public.inventory_stock
          set
            stock = stock + stock_rec.stock,
            reserved = reserved + stock_rec.reserved,
            assigned = assigned + stock_rec.assigned,
            unavailable = unavailable + stock_rec.unavailable,
            min_stock = greatest(min_stock, stock_rec.min_stock)
          where id = canonical_stock_id;

          delete from public.inventory_stock
          where id = stock_rec.id;
        else
          update public.inventory_stock
          set item_id = canonical_id
          where id = stock_rec.id;
        end if;
      end loop;

      update public.inventory_movements
      set item_id = canonical_id
      where item_id = dupe_id;

      update public.inventory_assignments
      set item_id = canonical_id
      where item_id = dupe_id;

      if to_regclass('public.logistics_truck_inventory_events') is not null then
        update public.logistics_truck_inventory_events
        set item_id = canonical_id
        where item_id = dupe_id;
      end if;

      delete from public.inventory_items
      where id = dupe_id;
    end loop;
  end loop;
end $$;

create unique index if not exists idx_inventory_items_leaf_unique
  on public.inventory_items (
    organization_id,
    category_id,
    kind,
    coalesce(subcategory, '')
  );
