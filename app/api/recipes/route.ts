import { NextResponse } from "next/server";
import { createRecipe, listRecipes } from "@/lib/supabase/recipes";
import { createRecipeSchema, listRecipesQuerySchema } from "@/lib/validation";
import type { ApiError, RecipeRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/recipes?q=&kind=&favorite=&limit=&offset= 手動レシピ一覧 */
export async function GET(
  request: Request
): Promise<NextResponse<RecipeRecord[] | ApiError>> {
  const { searchParams } = new URL(request.url);
  const parsed = listRecipesQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "検索条件が不正です" }, { status: 400 });
  }

  try {
    const recipes = await listRecipes({
      q: parsed.data.q,
      kind: parsed.data.kind,
      favoriteOnly: parsed.data.favorite === "true",
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    return NextResponse.json(recipes);
  } catch (err) {
    console.error("GET /api/recipes failed:", err);
    return NextResponse.json(
      { error: "レシピ一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/** POST /api/recipes 手動レシピ登録 */
export async function POST(
  request: Request
): Promise<NextResponse<RecipeRecord | ApiError>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const parsed = createRecipeSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "入力内容を確認してください";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const recipe = await createRecipe(parsed.data);
    return NextResponse.json(recipe, { status: 201 });
  } catch (err) {
    console.error("POST /api/recipes failed:", err);
    return NextResponse.json(
      { error: "レシピの保存に失敗しました" },
      { status: 500 }
    );
  }
}
