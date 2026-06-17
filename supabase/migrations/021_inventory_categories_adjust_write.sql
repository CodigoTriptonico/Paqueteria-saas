-- Permitir editar estructura de categorías desde inventario (inventory.adjust)

drop policy if exists inv_cat_write on public.inventory_categories;

create policy inv_cat_write on public.inventory_categories for all
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('settings.manage')
      or public.user_has_permission('warehouses.manage')
      or public.user_has_permission('inventory.adjust')
    )
  );
