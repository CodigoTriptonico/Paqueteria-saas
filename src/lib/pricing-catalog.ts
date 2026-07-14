import type { PricingBoxConfig, PricingCountryConfig } from "@/app/actions/pricing";
import {
  collectCategoryTreeLeaves,
  type TreeLeafRef,
} from "@/lib/inventory-stock";
import type { CategoryConfig } from "@/lib/inventory-tree";
import { normalizeInventoryText } from "@/lib/inventory-tree";

export type InventoryCatalogProduct = {
  catalogKey: string;
  label: string;
  path: string;
  category: string;
  kind: string;
  subcategory?: string;
};

export type ProductCountryAssignment = {
  countryName: string;
  price: string;
  active: boolean;
};

function normalizeLabel(value: string) {
  return normalizeInventoryText(value).trim();
}

export function catalogKeyFromLeaf(leaf: Pick<TreeLeafRef, "category" | "kind" | "subcategory">) {
  return [
    normalizeLabel(leaf.category),
    normalizeLabel(leaf.kind),
    normalizeLabel(leaf.subcategory || ""),
  ].join("|");
}

export function catalogKeyFromStockItem(item: {
  category: string;
  kind: string;
  subcategory?: string;
}) {
  return catalogKeyFromLeaf({
    category: item.category,
    kind: item.kind,
    subcategory: item.subcategory,
  });
}

function catalogProductPath(leaf: TreeLeafRef) {
  const parts = [leaf.category];

  if (leaf.subcategory) {
    parts.push(leaf.subcategory);
  }

  if (leaf.kind !== leaf.name) {
    parts.push(leaf.kind);
  }

  parts.push(leaf.name);
  return [...new Set(parts)].join(" · ");
}

export function catalogProductFromLeaf(leaf: TreeLeafRef): InventoryCatalogProduct {
  return {
    catalogKey: catalogKeyFromLeaf(leaf),
    label: leaf.name,
    path: catalogProductPath(leaf),
    category: leaf.category,
    kind: leaf.kind,
    subcategory: leaf.subcategory,
  };
}

export function listCatalogProducts(categoryConfigs: CategoryConfig[]): InventoryCatalogProduct[] {
  const products: InventoryCatalogProduct[] = [];
  const seen = new Set<string>();

  for (const category of categoryConfigs) {
    for (const leaf of collectCategoryTreeLeaves(category)) {
      const product = catalogProductFromLeaf(leaf);

      if (seen.has(product.catalogKey)) {
        continue;
      }

      seen.add(product.catalogKey);
      products.push(product);
    }
  }

  return products.sort((left, right) => left.path.localeCompare(right.path, "es"));
}

function findBoxByCatalogKey(boxes: PricingBoxConfig[], catalogKey: string) {
  const target = normalizeLabel(catalogKey);
  return boxes.find((box) => normalizeLabel(box.catalogKey || "") === target);
}

export function isProductAssignedToCountry(
  boxes: PricingBoxConfig[],
  product: InventoryCatalogProduct,
) {
  if (findBoxByCatalogKey(boxes, product.catalogKey)) {
    return true;
  }

  const label = normalizeLabel(product.label);
  const kind = normalizeLabel(product.kind);

  return boxes.some((box) => {
    const size = normalizeLabel(box.size);
    return size === label || size === kind;
  });
}

export function addProductToCountry(
  countries: PricingCountryConfig[],
  countryName: string,
  product: InventoryCatalogProduct,
): PricingCountryConfig[] {
  return countries.map((country) => {
    if (country.name !== countryName) {
      return country;
    }

    if (findBoxByCatalogKey(country.boxes, product.catalogKey)) {
      return country;
    }

    return {
      ...country,
      boxes: [
        ...country.boxes,
        {
          size: product.label,
          price: "$0",
          cost: "$0",
          catalogKey: product.catalogKey,
        },
      ],
    };
  });
}

export function removeProductFromCountry(
  countries: PricingCountryConfig[],
  countryName: string,
  catalogKey: string,
): PricingCountryConfig[] {
  const target = normalizeLabel(catalogKey);

  return countries.map((country) => {
    if (country.name !== countryName) {
      return country;
    }

    return {
      ...country,
      boxes: country.boxes.filter(
        (box) => normalizeLabel(box.catalogKey || box.size) !== target,
      ),
    };
  });
}

export function setProductCountryAssignments(
  countries: PricingCountryConfig[],
  product: InventoryCatalogProduct,
  assignments: ProductCountryAssignment[],
): PricingCountryConfig[] {
  return countries.map((country) => {
    const assignment = assignments.find((entry) => entry.countryName === country.name);

    if (!assignment) {
      return country;
    }

    const existing = findBoxByCatalogKey(country.boxes, product.catalogKey);

    if (!assignment.active) {
      if (!existing) {
        return country;
      }

      return {
        ...country,
        boxes: country.boxes.filter((box) => box !== existing),
      };
    }

    const price = assignment.price || "$0";
    const nextBox: PricingBoxConfig = {
      size: product.label,
      price,
      cost: existing?.cost || "$0",
      catalogKey: product.catalogKey,
    };

    if (existing) {
      return {
        ...country,
        boxes: country.boxes.map((box) => (box === existing ? nextBox : box)),
      };
    }

    return {
      ...country,
      boxes: [...country.boxes, nextBox],
    };
  });
}

export function productCountryAssignments(
  countries: PricingCountryConfig[],
  catalogKey: string,
): ProductCountryAssignment[] {
  return countries.map((country) => {
    const box = findBoxByCatalogKey(country.boxes, catalogKey);

    return {
      countryName: country.name,
      price: box?.price || "$0",
      active: Boolean(box),
    };
  });
}
