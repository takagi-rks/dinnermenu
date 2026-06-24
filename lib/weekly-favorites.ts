import type { WeeklyDish } from "@/lib/types";

export type WeeklyDishKind = "main" | "side";

const STORAGE_KEY = "dinnermenu:weekly-favorites:v1";

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "");
}

export function weeklyFavoriteKey(
  kind: WeeklyDishKind,
  dish: WeeklyDish
): string {
  const ingredients = dish.keyIngredients.map(normalize).sort().join(",");
  return `${kind}:${normalize(dish.dishName)}:${ingredients}`;
}

export function loadWeeklyFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]"
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function saveWeeklyFavorites(keys: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(keys)]));
  } catch {
    // localStorage容量超過等は握り潰す
  }
}
