import type { DayMealPlan } from "@/lib/types";
import {
  SHOPPING_CATEGORY_DEFINITIONS,
  type ShoppingCategoryId,
} from "@/lib/weekly-shopping-categories";

export type { ShoppingCategoryId } from "@/lib/weekly-shopping-categories";

export interface ShoppingCategory {
  id: ShoppingCategoryId;
  label: string;
  items: ShoppingCategoryItem[];
}

export interface ShoppingCategoryItem {
  item: string;
  originalIndex: number;
}

function normalizeItemName(item: string): string {
  return item
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ 　]/g, "")
    .replace(/[（(].*?[）)]/g, "")
    .replace(/\d+(?:\.\d+)?(?:g|kg|ml|l|個|本|枚|束|袋|パック|缶|丁|玉|大さじ|小さじ|少々|適量)/g, "")
    .replace(/[、,].*$/g, "")
    .trim();
}

function normalizeForMatch(item: string): string {
  return normalizeItemName(item).replace(/^(冷凍|生|乾燥|刻み|すりおろし)/g, "");
}

function isAvailableIngredient(item: string, availableIngredients: string[]): boolean {
  const normalizedItem = normalizeForMatch(item);
  if (!normalizedItem) return false;

  return availableIngredients.some((ingredient) => {
    const normalizedIngredient = normalizeForMatch(ingredient);
    return (
      normalizedIngredient.length > 0 &&
      (normalizedItem === normalizedIngredient ||
        normalizedItem.includes(normalizedIngredient) ||
        normalizedIngredient.includes(normalizedItem))
    );
  });
}

export function rebuildShoppingList(
  days: DayMealPlan[],
  availableIngredients: string[]
): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const day of days) {
    const ingredients = [...day.main.keyIngredients, ...day.side.keyIngredients];
    for (const ingredient of ingredients) {
      const item = ingredient.trim();
      if (!item || isAvailableIngredient(item, availableIngredients)) continue;

      const key = normalizeForMatch(item);
      if (!key || seen.has(key)) continue;

      seen.add(key);
      items.push(item);
    }
  }

  return items;
}

export function carryCheckedItems(
  previousItems: string[],
  previousChecked: boolean[],
  nextItems: string[]
): boolean[] {
  const checkedByKey = new Map<string, boolean>();

  previousItems.forEach((item, index) => {
    const key = normalizeForMatch(item);
    if (key && (previousChecked[index] ?? false)) {
      checkedByKey.set(key, true);
    }
  });

  return nextItems.map((item) => checkedByKey.get(normalizeForMatch(item)) ?? false);
}

function detectCategory(item: string): ShoppingCategoryId {
  const normalized = normalizeForMatch(item);

  for (const category of SHOPPING_CATEGORY_DEFINITIONS) {
    if (category.id === "other") continue;
    if (category.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return category.id;
    }
  }

  return "other";
}

export function categorizeShoppingList(items: string[]): ShoppingCategory[] {
  const categories = SHOPPING_CATEGORY_DEFINITIONS.map<ShoppingCategory>(({ id, label }) => ({
    id,
    label,
    items: [],
  }));

  const categoryById = new Map(categories.map((category) => [category.id, category]));

  items.forEach((item, originalIndex) => {
    const category = categoryById.get(detectCategory(item));
    category?.items.push({ item, originalIndex });
  });

  return categories.filter((category) => category.items.length > 0);
}
