import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateMealInput,
  DishStat,
  MealRecord,
  MonthlyCostSummary,
  UpdateMealInput,
} from "@/lib/types";

/** DB行(snake_case)の型。境界変換はこのファイル内に閉じる */
interface MealRow {
  id: string;
  cooked_on: string;
  dish_name: string;
  ingredients: string[];
  steps: string[];
  rating: number | null;
  memo: string;
  is_favorite: boolean;
  cost_yen: number | null;
  created_at: string;
}

let cachedClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません");
  }
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

function toRecord(row: MealRow): MealRecord {
  return {
    id: row.id,
    cookedOn: row.cooked_on,
    dishName: row.dish_name,
    ingredients: row.ingredients ?? [],
    steps: row.steps ?? [],
    rating: row.rating,
    memo: row.memo ?? "",
    isFavorite: row.is_favorite,
    costYen: row.cost_yen ?? null,
    createdAt: row.created_at,
  };
}

function sanitizeSearchTerm(q: string): string {
  return q.replace(/[%_,()]/g, " ").trim();
}

export interface ListMealsParams {
  q?: string;
  favoriteOnly?: boolean;
  limit: number;
  offset: number;
}

export async function listMeals(params: ListMealsParams): Promise<MealRecord[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("meals")
    .select("*")
    .order("cooked_on", { ascending: false })
    .order("created_at", { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (params.favoriteOnly) query = query.eq("is_favorite", true);
  if (params.q) {
    const term = sanitizeSearchTerm(params.q);
    if (term) query = query.or(`dish_name.ilike.*${term}*,memo.ilike.*${term}*`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("listMeals failed:", error.message);
    throw new Error("献立履歴の取得に失敗しました");
  }
  return (data as MealRow[]).map(toRecord);
}

export async function createMeal(input: CreateMealInput): Promise<MealRecord> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("meals")
    .insert({
      cooked_on: input.cookedOn,
      dish_name: input.dishName,
      ingredients: input.ingredients,
      steps: input.steps,
      rating: input.rating ?? null,
      memo: input.memo ?? "",
      is_favorite: input.isFavorite ?? false,
      cost_yen: input.costYen ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("createMeal failed:", error.message);
    throw new Error("献立の保存に失敗しました");
  }
  return toRecord(data as MealRow);
}

export async function updateMeal(
  id: string,
  input: UpdateMealInput
): Promise<MealRecord> {
  const supabase = getSupabase();
  const patch: Partial<MealRow> = {};
  if (input.dishName !== undefined) patch.dish_name = input.dishName;
  if (input.cookedOn !== undefined) patch.cooked_on = input.cookedOn;
  if (input.rating !== undefined) patch.rating = input.rating;
  if (input.memo !== undefined) patch.memo = input.memo;
  if (input.isFavorite !== undefined) patch.is_favorite = input.isFavorite;
  if (input.costYen !== undefined) patch.cost_yen = input.costYen;

  const { data, error } = await supabase
    .from("meals")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("updateMeal failed:", error.message);
    throw new Error("献立の更新に失敗しました");
  }
  return toRecord(data as MealRow);
}

export async function deleteMeal(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("meals").delete().eq("id", id);
  if (error) {
    console.error("deleteMeal failed:", error.message);
    throw new Error("献立の削除に失敗しました");
  }
}

export async function createMealsBulk(
  inputs: CreateMealInput[]
): Promise<MealRecord[]> {
  const supabase = getSupabase();
  const rows = inputs.map((input) => ({
    cooked_on: input.cookedOn,
    dish_name: input.dishName,
    ingredients: input.ingredients,
    steps: input.steps,
    rating: input.rating ?? null,
    memo: input.memo ?? "",
    is_favorite: input.isFavorite ?? false,
    cost_yen: input.costYen ?? null,
  }));

  const { data, error } = await supabase.from("meals").insert(rows).select();
  if (error) {
    console.error("createMealsBulk failed:", error.message);
    throw new Error("週間献立の保存に失敗しました");
  }
  return (data as MealRow[]).map(toRecord);
}

export async function listRecentDishNames(limit: number): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("meals")
    .select("dish_name")
    .order("cooked_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("listRecentDishNames failed:", error.message);
    throw new Error("直近の献立の取得に失敗しました");
  }
  return (data as Pick<MealRow, "dish_name">[]).map((row) => row.dish_name);
}

const STATS_SCAN_LIMIT = 2000;

export async function getDishStats(topN: number): Promise<DishStat[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("meals")
    .select("dish_name")
    .order("created_at", { ascending: false })
    .limit(STATS_SCAN_LIMIT);

  if (error) {
    console.error("getDishStats failed:", error.message);
    throw new Error("統計の取得に失敗しました");
  }

  const counts = new Map<string, number>();
  for (const row of data as Pick<MealRow, "dish_name">[]) {
    counts.set(row.dish_name, (counts.get(row.dish_name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([dishName, count]) => ({ dishName, count }))
    .sort((a, b) => b.count - a.count || a.dishName.localeCompare(b.dishName, "ja"))
    .slice(0, topN);
}

/** 月別食費集計(直近N件のcosted recordをサーバー側でgroupBy) */
const COST_SCAN_LIMIT = 5000;

export async function getMonthlyCostSummary(): Promise<MonthlyCostSummary[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("meals")
    .select("cooked_on, cost_yen")
    .not("cost_yen", "is", null)
    .order("cooked_on", { ascending: false })
    .limit(COST_SCAN_LIMIT);

  if (error) {
    console.error("getMonthlyCostSummary failed:", error.message);
    throw new Error("食費集計の取得に失敗しました");
  }

  const map = new Map<string, { total: number; count: number }>();
  for (const row of data as Pick<MealRow, "cooked_on" | "cost_yen">[]) {
    if (row.cost_yen === null) continue;
    const yearMonth = row.cooked_on.slice(0, 7); // YYYY-MM
    const existing = map.get(yearMonth) ?? { total: 0, count: 0 };
    map.set(yearMonth, {
      total: existing.total + row.cost_yen,
      count: existing.count + 1,
    });
  }

  return [...map.entries()]
    .map(([yearMonth, { total, count }]) => ({
      yearMonth,
      totalCostYen: total,
      recordCount: count,
    }))
    .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
}
