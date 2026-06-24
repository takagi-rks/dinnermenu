import type { WeeklyDish } from "@/lib/types";

export type WeeklyDishKind = "main" | "side";

export interface WeeklyFavorite {
  key: string;
  kind: WeeklyDishKind;
  dishName: string;
  keyIngredients: string[];
}

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

/**
 * 保存済みの識別子を一覧表示用データに変換する。
 * 現行の保存形式に合わない値は、呼び出し側で安全に除外できるよう null を返す。
 */
export function parseWeeklyFavorite(key: string): WeeklyFavorite | null {
  const match = /^(main|side):([^:]+):(.*)$/.exec(key);
  if (!match) return null;

  const kind = match[1];
  const dishName = match[2];
  const ingredients = match[3];
  if ((kind !== "main" && kind !== "side") || !dishName) return null;

  return {
    key,
    kind,
    dishName,
    keyIngredients: ingredients
      ? ingredients.split(",").filter((ingredient) => ingredient.length > 0)
      : [],
  };
}

export function loadWeeklyFavoriteEntries(): WeeklyFavorite[] {
  const entries = new Map<string, WeeklyFavorite>();
  for (const key of loadWeeklyFavorites()) {
    const favorite = parseWeeklyFavorite(key);
    if (favorite) entries.set(key, favorite);
  }
  return [...entries.values()];
}
