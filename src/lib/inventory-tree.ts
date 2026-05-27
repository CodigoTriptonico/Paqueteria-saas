export type InventoryTreeItem = {
  id: string;
  name: string;
  children?: InventoryTreeItem[];
};

export type CategoryConfig = {
  name: string;
  items?: InventoryTreeItem[];
  types?: string[];
};

export const normalizeInventoryText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export const categoryItems = (category: CategoryConfig) =>
  category.items?.length ? category.items : [];

/** Subcategoría: tiene `children` (aunque esté vacío). Item directo: solo `id` y `name`. */
export const isInventoryGroup = (item: InventoryTreeItem) => item.children !== undefined;

export const categorySubcategories = (category: CategoryConfig) =>
  categoryItems(category).filter(isInventoryGroup);

export const categoryDirectItems = (category: CategoryConfig) =>
  categoryItems(category).filter((item) => !isInventoryGroup(item));

export const countCategoryLeafItems = (category: CategoryConfig): number => {
  const items = categoryItems(category);

  return items.reduce((sum, item) => {
    if (isInventoryGroup(item)) {
      return sum + (item.children?.length || 0);
    }

    return sum + 1;
  }, 0);
};

export const countInventoryTreeItems = (items: InventoryTreeItem[]): number =>
  items.reduce((sum, item) => {
    if (isInventoryGroup(item)) {
      return sum + countInventoryTreeItems(item.children || []);
    }

    return sum + 1;
  }, 0);

export function addInventoryTreeChild(
  items: InventoryTreeItem[],
  parentId: string,
  child: InventoryTreeItem,
): InventoryTreeItem[] {
  return items.map((item) => {
    if (item.id === parentId) {
      return { ...item, children: [...(item.children || []), child] };
    }

    return {
      ...item,
      children: item.children ? addInventoryTreeChild(item.children, parentId, child) : item.children,
    };
  });
}

export function updateInventoryTreeItem(
  items: InventoryTreeItem[],
  itemId: string,
  name: string,
): InventoryTreeItem[] {
  return items.map((item) => {
    if (item.id === itemId) {
      return { ...item, name };
    }

    return {
      ...item,
      children: item.children ? updateInventoryTreeItem(item.children, itemId, name) : item.children,
    };
  });
}

export function deleteInventoryTreeItem(
  items: InventoryTreeItem[],
  itemId: string,
): InventoryTreeItem[] {
  return items
    .filter((item) => item.id !== itemId)
    .map((item) => ({
      ...item,
      children: item.children ? deleteInventoryTreeItem(item.children, itemId) : item.children,
    }));
}

export function inventoryTreeItemExists(items: InventoryTreeItem[], name: string) {
  return items.some((item) => normalizeInventoryText(item.name) === normalizeInventoryText(name));
}
