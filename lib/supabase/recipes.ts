import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateRecipeInput,
  DishKind,
  RecipeRecord,
  UpdateRecipeInput,
} from "@/lib/types";

/** DB行(snake_case)の型。境界変換はこのファイル内に閉じる */
interface RecipeRow {
  id: string;
  recipe_name: string;
  kind: DishKind;
  ingredients: string[];
  memo: string;
  recipe_url: string;
  rating: number | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

let cachedClient: SupabaseClient | null = null;

function describeErrorCause(cause: unknown): unknown {
  if (cause instanceof Error) {
    return { name: cause.name, message: cause.message };
  }
  if (typeof cause === "string" || typeof cause === "number" || typeof cause === "boolean") {
    return cause;
  }
  return cause === undefined ? undefined : "Unknown cause";
}

function createSupabaseFetch(host: string): typeof fetch {
  return async (input, init) => {
    try {
      return await fetch(input, init);
    } catch (error: unknown) {
      console.error("Supabase fetch failed", {
        host,
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : "Unknown error",
        cause: error instanceof Error ? describeErrorCause(error.cause) : undefined,
      });
      throw error;
    }
  };
}

function getSupabase(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません");
  }
  cachedClient = createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: createSupabaseFetch(new URL(url).host) },
  });
  return cachedClient;
}

function toRecord(row: RecipeRow): RecipeRecord {
  return {
    id: row.id,
    recipeName: row.recipe_name,
    kind: row.kind,
    ingredients: row.ingredients ?? [],
    memo: row.memo ?? "",
    recipeUrl: row.recipe_url ?? "",
    rating: row.rating,
    isFavorite: row.is_favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sanitizeSearchTerm(q: string): string {
  return q.replace(/[%_,()]/g, " ").trim();
}

export interface ListRecipesParams {
  q?: string;
  kind?: DishKind;
  favoriteOnly?: boolean;
  limit: number;
  offset: number;
}

export async function listRecipes(
  params: ListRecipesParams
): Promise<RecipeRecord[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (params.kind) query = query.eq("kind", params.kind);
  if (params.favoriteOnly) query = query.eq("is_favorite", true);
  if (params.q) {
    const term = sanitizeSearchTerm(params.q);
    if (term) {
      query = query.or(
        `recipe_name.ilike.*${term}*,memo.ilike.*${term}*,recipe_url.ilike.*${term}*`
      );
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error("listRecipes failed:", error.message);
    throw new Error("レシピ一覧の取得に失敗しました");
  }
  return (data as RecipeRow[]).map(toRecord);
}

export async function createRecipe(
  input: CreateRecipeInput
): Promise<RecipeRecord> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("recipes")
    .insert({
      recipe_name: input.recipeName,
      kind: input.kind,
      ingredients: input.ingredients,
      memo: input.memo ?? "",
      recipe_url: input.recipeUrl ?? "",
      rating: input.rating ?? null,
      is_favorite: input.isFavorite ?? false,
    })
    .select()
    .single();

  if (error) {
    console.error("createRecipe failed:", error.message);
    throw new Error("レシピの保存に失敗しました");
  }
  return toRecord(data as RecipeRow);
}

export async function updateRecipe(
  id: string,
  input: UpdateRecipeInput
): Promise<RecipeRecord> {
  const supabase = getSupabase();
  const patch: Partial<RecipeRow> = {
    updated_at: new Date().toISOString(),
  };
  if (input.recipeName !== undefined) patch.recipe_name = input.recipeName;
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.ingredients !== undefined) patch.ingredients = input.ingredients;
  if (input.memo !== undefined) patch.memo = input.memo;
  if (input.recipeUrl !== undefined) patch.recipe_url = input.recipeUrl;
  if (input.rating !== undefined) patch.rating = input.rating;
  if (input.isFavorite !== undefined) patch.is_favorite = input.isFavorite;

  const { data, error } = await supabase
    .from("recipes")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("updateRecipe failed:", error.message);
    throw new Error("レシピの更新に失敗しました");
  }
  return toRecord(data as RecipeRow);
}

export async function deleteRecipe(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) {
    console.error("deleteRecipe failed:", error.message);
    throw new Error("レシピの削除に失敗しました");
  }
}
