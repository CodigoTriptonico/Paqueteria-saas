import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PricingCountryConfig } from "@/app/actions/pricing";
import type { CategoryConfig } from "@/lib/inventory-tree";
import {
  addProductToCountry,
  catalogKeyFromLeaf,
  isProductAssignedToCountry,
  listCatalogProducts,
  productCountryAssignments,
  removeProductFromCountry,
  setProductCountryAssignments,
} from "./pricing-catalog";

const sampleTree: CategoryConfig[] = [
  {
    name: "Cajas",
    items: [
      {
        id: "sub-1",
        name: "Medidas",
        children: [
          { id: "1", name: "12x12x12" },
          { id: "2", name: "14x14x14" },
        ],
      },
    ],
  },
];

const mexicoCountry: PricingCountryConfig = {
  code: "MX",
  name: "México",
  deliveryTime: "5-8 dias",
  boxes: [],
};

const colombiaCountry: PricingCountryConfig = {
  code: "CO",
  name: "Colombia",
  deliveryTime: "7-10 dias",
  boxes: [],
};

describe("pricing-catalog", () => {
  it("lists catalog products with stable keys", () => {
    const products = listCatalogProducts(sampleTree);

    assert.equal(products.length, 2);
    assert.equal(products[0]?.label, "12x12x12");
    assert.match(products[0]?.path || "", /Cajas/);
    assert.equal(
      products[0]?.catalogKey,
      catalogKeyFromLeaf({
        category: "Cajas",
        kind: "12x12x12",
        subcategory: "Medidas",
      }),
    );
  });

  it("adds and removes products from a country", () => {
    const product = listCatalogProducts(sampleTree)[1]!;
    const withProduct = addProductToCountry([mexicoCountry], "México", product);

    assert.equal(withProduct[0]?.boxes.length, 1);
    assert.equal(withProduct[0]?.boxes[0]?.size, "14x14x14");
    assert.equal(withProduct[0]?.boxes[0]?.catalogKey, product.catalogKey);

    const withoutProduct = removeProductFromCountry(withProduct, "México", product.catalogKey);
    assert.equal(withoutProduct[0]?.boxes.length, 0);
  });

  it("detects assigned products by catalog key or legacy size", () => {
    const product = listCatalogProducts(sampleTree)[1]!;
    const withCatalogKey = addProductToCountry([mexicoCountry], "México", product);

    assert.equal(
      isProductAssignedToCountry(withCatalogKey[0]?.boxes || [], product),
      true,
    );

    const legacyCountry: PricingCountryConfig = {
      ...mexicoCountry,
      boxes: [{ size: "14x14x14", price: "$10", cost: "$5" }],
    };

    assert.equal(isProductAssignedToCountry(legacyCountry.boxes, product), true);
    assert.equal(
      isProductAssignedToCountry([], listCatalogProducts(sampleTree)[0]!),
      false,
    );
  });

  it("sets country assignments from inventory modal", () => {
    const product = listCatalogProducts(sampleTree)[0]!;
    const countries = [mexicoCountry, colombiaCountry];
    const next = setProductCountryAssignments(countries, product, [
      { countryName: "México", price: "$25", cost: "$12", active: true },
      { countryName: "Colombia", price: "$30", cost: "$15", active: true },
    ]);

    assert.equal(next[0]?.boxes[0]?.price, "$25");
    assert.equal(next[0]?.boxes[0]?.cost, "$12");
    assert.equal(next[1]?.boxes[0]?.price, "$30");
    assert.equal(next[1]?.boxes[0]?.cost, "$15");

    const assignments = productCountryAssignments(next, product.catalogKey);
    assert.deepEqual(
      assignments.map((entry) => ({
        name: entry.countryName,
        price: entry.price,
        cost: entry.cost,
        active: entry.active,
      })),
      [
        { name: "México", price: "$25", cost: "$12", active: true },
        { name: "Colombia", price: "$30", cost: "$15", active: true },
      ],
    );
  });
});
