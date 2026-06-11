import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CreateMealInput, MealRecord, UpdateMealInput } from "@/lib/types";

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
  created_at: string;
}

let cachedClient: SupabaseClient | null = null;

/**
 * Service Role Key を使うサーバー専用クライアント。
 * 個人利用前提のため RLS を介さず API Route 内で完結させる。
 * ビルド時に環境変数が無くても落ちないよう遅延初期化する。
 */
function getSupabase(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません"
    );
  }
  cachedClient = createClient(url, key, {
    auth: { persistSession: false },
  });
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
    createdAt: row.created_at,
  };
}

export interface ListMealsParams {
  q?: string;
  favoriteOnly?: boolean;
  limit: number;
  offset: number;
}

/** 検索語からPostgRESTのor句に影響する記号を除去 */
function sanitizeSearchTerm(q: string): string {
  return q.replace(/[%_,()]/g, " ").trim();
}

export async function listMeals(params: ListMealsParams): Promise<MealRecord[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("meals")
    .select("*")
    .order("cooked_on", { ascending: false })
    .order("created_at", { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (params.favoriteOnly) {
    query = query.eq("is_favorite", true);
  }
  if (params.q) {
    const term = sanitizeSearchTerm(params.q);
    if (term) {
      query = query.or(`dish_name.ilike.*${term}*,memo.ilike.*${term}*`);
    }
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

/**
 * AI提案で重複を避けるための直近の料理名一覧。
 * 提案機能の補助情報のため、失敗しても呼び出し側で握り潰せるよう例外はそのまま投げる。
 */
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

export async function deleteMeal(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("meals").delete().eq("id", id);
  if (error) {
    console.error("deleteMeal failed:", error.message);
    throw new Error("献立の削除に失敗しました");
  }
}
