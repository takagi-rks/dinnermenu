import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteMeal, updateMeal } from "@/lib/supabase/meals";
import { updateMealSchema } from "@/lib/validation";
import type { ApiError, MealRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/meals/:id 評価・メモ・お気に入りの部分更新 */
export async function PATCH(
  request: Request,
  context: RouteContext
): Promise<NextResponse<MealRecord | ApiError>> {
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

  const parsed = updateMealSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "入力内容を確認してください";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const meal = await updateMeal(id, parsed.data);
    return NextResponse.json(meal);
  } catch (err) {
    console.error(`PATCH /api/meals/${id} failed:`, err);
    return NextResponse.json(
      { error: "献立の更新に失敗しました" },
      { status: 500 }
    );
  }
}

/** DELETE /api/meals/:id 履歴削除 */
export async function DELETE(
  _request: Request,
  context: RouteContext
): Promise<NextResponse<{ ok: true } | ApiError>> {
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "IDが不正です" }, { status: 400 });
  }

  try {
    await deleteMeal(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`DELETE /api/meals/${id} failed:`, err);
    return NextResponse.json(
      { error: "献立の削除に失敗しました" },
      { status: 500 }
    );
  }
}
