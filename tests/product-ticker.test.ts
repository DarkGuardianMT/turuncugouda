import assert from 'node:assert/strict';
import { test } from 'node:test';
import { menu } from '../src/data/menu.ts';
import { tickerProducts } from '../src/data/productTicker.ts';

test('ticker uses distinct existing menu product/category names without inventing products', () => {
  const menuNames = new Set(menu.flatMap((group) => [group.name, ...group.categories.flatMap((category) => [
    category.name, category.name.split(' — ').at(-1), ...category.items.map((item) => item.name),
  ])]));
  assert.equal(tickerProducts.length, 9);
  assert.equal(new Set(tickerProducts).size, tickerProducts.length);
  for (const name of tickerProducts) assert.ok(menuNames.has(name), `Ticker product must exist in menu data: ${name}`);
});
