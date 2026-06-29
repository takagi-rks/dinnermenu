import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteRecipe, updateRecipe } from "@/lib/supabase/recipes";
import { updateRecipeSchema } from "@/lib/validation";
import type { ApiError, RecipeRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/recipes/:id 手動レシピの部分更新 */
export async function PATCH(
  request: Request,
  context: RouteContext
): Promise<NextResponse<RecipeRecord | ApiError>> {
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "IDが不正です" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const parsed = updateRecipeSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "入力内容を確認してください";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const recipe = await updateRecipe(id, parsed.data);
    return NextResponse.json(recipe);
  } catch (err) {
    console.error(`PATCH /api/recipes/${id} failed:`, err);
    return NextResponse.json(
      { error: "レシピの更新に失敗しました" },
      { status: 500 }
    );
  }
}

/** DELETE /api/recipes/:id 手動レシピ削除 */
export async function DELETE(
  _request: Request,
  context: RouteContext
): Promise<NextResponse<{ ok: true } | ApiError>> {
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "IDが不正です" }, { status: 400 });
  }

  try {
    await deleteRecipe(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`DELETE /api/recipes/${id} failed:`, err);
    return NextResponse.json(
      { error: "レシピの削除に失敗しました" },
      { status: 500 }
    );
  }
}
