import { NextResponse } from "next/server";
import { createMealsBulk } from "@/lib/supabase/meals";
import { bulkCreateMealsSchema } from "@/lib/validation";
import type { ApiError, MealRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/meals/bulk 週間献立の一括保存 */
export async function POST(
  request: Request
): Promise<NextResponse<MealRecord[] | ApiError>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const parsed = bulkCreateMealsSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "入力内容を確認してください";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const meals = await createMealsBulk(parsed.data.meals);
    return NextResponse.json(meals, { status: 201 });
  } catch (err) {
    console.error("POST /api/meals/bulk failed:", err);
    return NextResponse.json(
      { error: "週間献立の保存に失敗しました" },
      { status: 500 }
    );
  }
}
